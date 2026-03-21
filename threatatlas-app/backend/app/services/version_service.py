from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.models import (
    Diagram,
    DiagramVersion,
    DiagramThreatVersion,
    DiagramMitigationVersion,
    DiagramThreat,
    DiagramMitigation
)
from app.schemas.diagram_version import (
    DiagramVersionSummary,
    DiagramVersionComparison,
    ElementChange,
    ThreatChange,
    DiagramThreatVersionSnapshot
)


class VersionService:
    """Service for managing diagram versions."""

    @staticmethod
    def create_version(
        db: Session,
        diagram: Diagram,
        comment: Optional[str] = None
    ) -> DiagramVersion:
        """
        Create a new version snapshot of the diagram.

        Args:
            db: Database session
            diagram: Diagram to snapshot
            comment: Optional comment about this version

        Returns:
            Created DiagramVersion
        """
        # Increment version number
        new_version_number = diagram.current_version + 1

        # Create version snapshot
        version = DiagramVersion(
            diagram_id=diagram.id,
            version_number=new_version_number,
            diagram_data=diagram.diagram_data,
            name=diagram.name,
            description=diagram.description,
            comment=comment
        )
        db.add(version)
        db.flush()  # Get version.id

        # Snapshot all current threats
        for threat in diagram.diagram_threats:
            threat_version = DiagramThreatVersion(
                version_id=version.id,
                diagram_threat_id=threat.id,
                element_id=threat.element_id,
                element_type=threat.element_type,
                threat_id=threat.threat_id,
                status=threat.status,
                notes=threat.notes,
                likelihood=threat.likelihood,
                impact=threat.impact,
                risk_score=threat.risk_score,
                severity=threat.severity
            )
            db.add(threat_version)

        # Snapshot all current mitigations
        for mitigation in diagram.diagram_mitigations:
            mitigation_version = DiagramMitigationVersion(
                version_id=version.id,
                diagram_mitigation_id=mitigation.id,
                element_id=mitigation.element_id,
                element_type=mitigation.element_type,
                mitigation_id=mitigation.mitigation_id,
                threat_id=mitigation.threat_id,
                status=mitigation.status,
                notes=mitigation.notes
            )
            db.add(mitigation_version)

        # Update diagram's current version
        diagram.current_version = new_version_number

        db.commit()
        db.refresh(version)

        return version

    @staticmethod
    def restore_version(
        db: Session,
        diagram: Diagram,
        version_number: int
    ) -> DiagramVersion:
        """
        Restore diagram to a previous version (creates new version).

        Args:
            db: Database session
            diagram: Diagram to restore
            version_number: Version number to restore from

        Returns:
            New version created from restore

        Raises:
            ValueError: If version not found
        """
        # Get version to restore
        version = db.query(DiagramVersion).filter(
            DiagramVersion.diagram_id == diagram.id,
            DiagramVersion.version_number == version_number
        ).first()

        if not version:
            raise ValueError(f"Version {version_number} not found")

        # Update diagram with version data
        diagram.diagram_data = version.diagram_data
        diagram.name = version.name
        diagram.description = version.description

        # Create new version with restore comment
        restore_comment = f"Restored from version {version_number}"
        if version.comment:
            restore_comment += f" ({version.comment})"

        new_version = VersionService.create_version(
            db=db,
            diagram=diagram,
            comment=restore_comment
        )

        return new_version

    @staticmethod
    def compare_versions(
        db: Session,
        diagram_id: int,
        from_version: int,
        to_version: int
    ) -> DiagramVersionComparison:
        """
        Compare two versions and return differences.

        Args:
            db: Database session
            diagram_id: Diagram ID
            from_version: Starting version number
            to_version: Ending version number

        Returns:
            Comparison results

        Raises:
            ValueError: If versions not found
        """
        # Get both versions
        v_from = db.query(DiagramVersion).filter(
            DiagramVersion.diagram_id == diagram_id,
            DiagramVersion.version_number == from_version
        ).first()

        v_to = db.query(DiagramVersion).filter(
            DiagramVersion.diagram_id == diagram_id,
            DiagramVersion.version_number == to_version
        ).first()

        if not v_from or not v_to:
            raise ValueError("One or both versions not found")

        # Initialize comparison
        comparison = DiagramVersionComparison(
            from_version=from_version,
            to_version=to_version,
            total_risk_score_delta=0,
            from_total_risk_score=0,
            to_total_risk_score=0
        )

        # Compare diagram structure (nodes and edges)
        from_data = v_from.diagram_data or {}
        to_data = v_to.diagram_data or {}

        from_nodes = {n['id']: n for n in from_data.get('nodes', [])}
        to_nodes = {n['id']: n for n in to_data.get('nodes', [])}

        from_edges = {e['id']: e for e in from_data.get('edges', [])}
        to_edges = {e['id']: e for e in to_data.get('edges', [])}

        # Helper maps for element labels
        def get_item_label(item, default_id):
            if not item: return default_id
            # Try data.label, data.name, then top-level name/label
            data = item.get('data', {})
            if isinstance(data, dict):
                label = data.get('label') or data.get('name') or data.get('display_name')
                if label: return label
            return item.get('label') or item.get('name') or item.get('display_name') or default_id

        from_label_map = {n['id']: get_item_label(n, n['id']) for n in from_data.get('nodes', []) if 'id' in n}
        for e in from_data.get('edges', []):
            if 'id' in e:
                from_label_map[e['id']] = get_item_label(e, e['id'])
            
        to_label_map = {n['id']: get_item_label(n, n['id']) for n in to_data.get('nodes', []) if 'id' in n}
        for e in to_data.get('edges', []):
            if 'id' in e:
                to_label_map[e['id']] = get_item_label(e, e['id'])

        # Find node changes
        for node_id, node in to_nodes.items():
            if node_id not in from_nodes:
                comparison.nodes_added.append(ElementChange(
                    element_id=node_id,
                    element_type='node',
                    change_type='added',
                    after=node
                ))
            elif node != from_nodes[node_id]:
                comparison.nodes_modified.append(ElementChange(
                    element_id=node_id,
                    element_type='node',
                    change_type='modified',
                    before=from_nodes[node_id],
                    after=node
                ))

        for node_id, node in from_nodes.items():
            if node_id not in to_nodes:
                comparison.nodes_removed.append(ElementChange(
                    element_id=node_id,
                    element_type='node',
                    change_type='removed',
                    before=node
                ))

        # Find edge changes
        for edge_id, edge in to_edges.items():
            if edge_id not in from_edges:
                comparison.edges_added.append(ElementChange(
                    element_id=edge_id,
                    element_type='edge',
                    change_type='added',
                    after=edge
                ))
            elif edge != from_edges[edge_id]:
                comparison.edges_modified.append(ElementChange(
                    element_id=edge_id,
                    element_type='edge',
                    change_type='modified',
                    before=from_edges[edge_id],
                    after=edge
                ))

        for edge_id, edge in from_edges.items():
            if edge_id not in to_edges:
                comparison.edges_removed.append(ElementChange(
                    element_id=edge_id,
                    element_type='edge',
                    change_type='removed',
                    before=edge
                ))

        # Compare threats
        from_threats = {
            (t.element_id, t.threat_id): t
            for t in v_from.threat_versions
        }
        to_threats = {
            (t.element_id, t.threat_id): t
            for t in v_to.threat_versions
        }

        # Calculate total risk scores
        comparison.from_total_risk_score = sum(
            t.risk_score or 0 for t in v_from.threat_versions
        )
        comparison.to_total_risk_score = sum(
            t.risk_score or 0 for t in v_to.threat_versions
        )
        comparison.total_risk_score_delta = (
            comparison.to_total_risk_score - comparison.from_total_risk_score
        )

        # Find threat changes
        for key, threat_to in to_threats.items():
            if key not in from_threats:
                threat_to_snapshot = DiagramThreatVersionSnapshot.model_validate(threat_to)
                threat_to_snapshot.threat_name = threat_to.threat.name
                threat_to_snapshot.node_label = to_label_map.get(threat_to.element_id, threat_to.element_id)
                
                comparison.threats_added.append(ThreatChange(
                    element_id=threat_to.element_id,
                    threat_id=threat_to.threat_id,
                    change_type='added',
                    after=threat_to_snapshot,
                    risk_score_delta=threat_to.risk_score or 0
                ))
            else:
                threat_from = from_threats[key]
                threat_from_snapshot = DiagramThreatVersionSnapshot.model_validate(threat_from)

                # Check if anything changed
                if (threat_from.status != threat_to.status or
                    threat_from.likelihood != threat_to.likelihood or
                    threat_from.impact != threat_to.impact or
                    threat_from.risk_score != threat_to.risk_score or
                    threat_from.severity != threat_to.severity or
                    threat_from.notes != threat_to.notes):

                    threat_to_snapshot = DiagramThreatVersionSnapshot.model_validate(threat_to)
                    threat_to_snapshot.threat_name = threat_to.threat.name
                    threat_to_snapshot.node_label = to_label_map.get(threat_to.element_id, threat_to.element_id)
                    
                    threat_from_snapshot = DiagramThreatVersionSnapshot.model_validate(threat_from)
                    threat_from_snapshot.threat_name = threat_from.threat.name
                    threat_from_snapshot.node_label = from_label_map.get(threat_from.element_id, threat_from.element_id)

                    risk_delta = (threat_to.risk_score or 0) - (threat_from.risk_score or 0)
                    comparison.threats_modified.append(ThreatChange(
                        element_id=threat_to.element_id,
                        threat_id=threat_to.threat_id,
                        change_type='modified',
                        before=threat_from_snapshot,
                        after=threat_to_snapshot,
                        risk_score_delta=risk_delta
                    ))

        for key, threat_from in from_threats.items():
            if key not in to_threats:
                threat_from_snapshot = DiagramThreatVersionSnapshot.model_validate(threat_from)
                threat_from_snapshot.threat_name = threat_from.threat.name
                threat_from_snapshot.node_label = from_label_map.get(threat_from.element_id, threat_from.element_id)

                comparison.threats_removed.append(ThreatChange(
                    element_id=threat_from.element_id,
                    threat_id=threat_from.threat_id,
                    change_type='removed',
                    before=threat_from_snapshot,
                    risk_score_delta=-(threat_from.risk_score or 0)
                ))

        return comparison

    @staticmethod
    def get_version_summary(
        db: Session,
        version: DiagramVersion
    ) -> DiagramVersionSummary:
        """
        Calculate summary statistics for a version.

        Args:
            db: Database session
            version: Version to summarize

        Returns:
            Version summary with statistics
        """
        diagram_data = version.diagram_data or {}

        node_count = len(diagram_data.get('nodes', []))
        edge_count = len(diagram_data.get('edges', []))
        threat_count = len(version.threat_versions)
        total_risk_score = sum(
            t.risk_score or 0 for t in version.threat_versions
        )

        return DiagramVersionSummary(
            id=version.id,
            diagram_id=version.diagram_id,
            version_number=version.version_number,
            name=version.name,
            comment=version.comment,
            created_at=version.created_at,
            node_count=node_count,
            edge_count=edge_count,
            threat_count=threat_count,
            total_risk_score=total_risk_score
        )
