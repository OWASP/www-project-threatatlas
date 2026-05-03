"""
Pydantic-AI agent for threat modeling analysis.

The agent is constructed per-request so that AI config changes take effect
immediately without any cache invalidation.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.ai.encryption import decrypt_api_key
from app.models.ai import AIConfig

SYSTEM_PROMPT = """You are a senior application security engineer performing structured threat modeling on Data Flow Diagrams (DFDs).
You apply STRIDE, OWASP Top 10, LINDDUN, and any other framework loaded from the knowledge base.

## Conversational behaviour
Respond naturally to greetings and general questions. Only run the analysis workflow when the user
clearly requests a threat analysis, security review, or risk assessment. Ask one focused clarifying
question if the intent is ambiguous (e.g. "Which framework should I use?" or "Focus on data flows or all elements?").

## Analysis workflow — run for every security analysis request:

STEP -1 (only if model_id is None):
  Call `get_available_frameworks`. Pick the best fit (default: STRIDE for general, OWASP for web/API).
  Call `propose_create_model`. Tell the user which framework you chose and why.

STEP 0  Call `get_existing_diagram_analysis`. Build a mental map of what is already covered.
        Never re-propose an existing threat/mitigation.

STEP 1  Call `get_diagram_context`. Note: element types, labels, trust-boundary crossings, and
        what data flows between which elements — these drive which threats apply.

STEP 2  Call `get_knowledge_base_threats`.
STEP 3  Call `get_knowledge_base_mitigations`.

STEP 4  Analyse every non-boundary element and every data flow edge. For each:
        a. Consider the element type:
           - process: authentication bypass, injection, privilege escalation, insecure logic, logging gaps
           - datastore: access control, encryption at rest, injection, data leakage, integrity
           - external entity: spoofing, untrusted input, data harvesting, session abuse
           - data flow edge: interception (TLS), tampering, replay, injection, flooding
             (flag extra scrutiny when crosses_trust_boundary=true)
        b. Map applicable KB threats. Propose the top 5 most relevant.
           Call `propose_threat` with element_id, element_type, threat_id, reasoning (1 sentence).
           Do NOT include likelihood/impact/risk scoring — that is a separate user request.
        c. Call `propose_custom_threat` ONLY for important threats genuinely absent from the KB.

STEP 5  For each proposed threat, call `propose_mitigation` for the top 2-3 most relevant KB mitigations.
        Set `for_threat_proposal_id` to link them. Add `propose_custom_mitigation` only if needed.

STEP 6  Write a focused summary: elements covered, total threats and mitigations proposed, key findings.

## Risk assessment workflow — ONLY when user explicitly asks to score/measure/rate risk:
STEP R0  Call `get_existing_diagram_analysis`.
STEP R1  For threats where likelihood is null (or all if user asks full re-assessment):
         Call `propose_risk_update` with likelihood (1-5) and impact (1-5).
         Base on: element exposure, attack surface, downstream blast radius, data sensitivity.
STEP R2  Summarise distribution: X low / Y medium / Z high / W critical.

## Risk scoring scale (for propose_risk_update only):
- likelihood: 1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain
- impact: 1=Negligible, 2=Minor, 3=Moderate, 4=Major, 5=Catastrophic
- severity = L×I  (≤5 low · 6-12 medium · 13-19 high · ≥20 critical)

## Hard rules:
- Cover EVERY non-boundary element and EVERY data flow edge — never skip.
- Create a new model and threats and mitigations must be in a one shot call.
- Use KB ids whenever possible. Custom proposals only for genuine gaps not covered by existing entries.
- Reasoning: 1 sentence max per proposal — be specific (e.g. "Auth endpoint accepts credentials over HTTP").
- Never mutate diagram data directly. All proposals require user approval.
- Call `propose_removal` for any existing items that are clearly duplicated or no longer relevant.
"""


@dataclass
class AgentDeps:
    db: Session
    diagram_id: int
    conversation_id: int
    model_id: int | None
    framework_id: int | None
    proposals: list[dict[str, Any]] = field(default_factory=list)


def _make_openai_model(OpenAIModel, model_name: str, api_key: str, base_url: str | None = None):
    """Create OpenAIModel handling all known pydantic-ai API versions via introspection."""
    import inspect, os
    params = set(inspect.signature(OpenAIModel.__init__).parameters.keys())

    # pydantic-ai 0.0.20–0.0.x: openai_client kwarg
    if "openai_client" in params:
        from openai import AsyncOpenAI
        client_kw: dict[str, Any] = {"api_key": api_key}
        if base_url:
            client_kw["base_url"] = base_url
        return OpenAIModel(model_name, openai_client=AsyncOpenAI(**client_kw))

    # pydantic-ai 0.1+: provider kwarg
    if "provider" in params:
        try:
            from pydantic_ai.providers.openai import OpenAIProvider
            prov_kw: dict[str, Any] = {"api_key": api_key}
            if base_url:
                prov_kw["base_url"] = base_url
            return OpenAIModel(model_name, provider=OpenAIProvider(**prov_kw))
        except (ImportError, TypeError):
            pass

    # pydantic-ai 0.0.14: api_key kwarg
    if "api_key" in params:
        kw: dict[str, Any] = {"api_key": api_key}
        if base_url:
            kw["base_url"] = base_url
        return OpenAIModel(model_name, **kw)

    # Last resort: environment variables (thread-safe per-request via context vars is ideal,
    # but this works for single-tenant or low-concurrency deployments)
    os.environ["OPENAI_API_KEY"] = api_key
    if base_url:
        os.environ["OPENAI_BASE_URL"] = base_url
    return OpenAIModel(model_name)


def _make_anthropic_model(AnthropicModel, model_name: str, api_key: str):
    """Create AnthropicModel handling all known pydantic-ai API versions via introspection."""
    import inspect, os
    params = set(inspect.signature(AnthropicModel.__init__).parameters.keys())

    if "anthropic_client" in params:
        from anthropic import AsyncAnthropic
        return AnthropicModel(model_name, anthropic_client=AsyncAnthropic(api_key=api_key))

    if "provider" in params:
        try:
            from pydantic_ai.providers.anthropic import AnthropicProvider
            return AnthropicModel(model_name, provider=AnthropicProvider(api_key=api_key))
        except (ImportError, TypeError):
            pass

    if "api_key" in params:
        return AnthropicModel(model_name, api_key=api_key)

    os.environ["ANTHROPIC_API_KEY"] = api_key
    return AnthropicModel(model_name)


def build_agent(config: AIConfig):
    """Construct a pydantic-ai Agent for the given AI configuration."""
    try:
        from pydantic_ai import Agent
        from pydantic_ai.models.openai import OpenAIModel
        from pydantic_ai.models.anthropic import AnthropicModel
    except ImportError as exc:
        raise RuntimeError(
            "pydantic-ai is not installed. Run: pdm add pydantic-ai"
        ) from exc

    api_key = decrypt_api_key(config.api_key_encrypted)

    if config.provider == "anthropic":
        model = _make_anthropic_model(AnthropicModel, config.model_name, api_key)
    else:
        model = _make_openai_model(OpenAIModel, config.model_name, api_key, config.base_url)

    agent: Agent[AgentDeps, str] = Agent(
        model,
        deps_type=AgentDeps,
        system_prompt=SYSTEM_PROMPT,
    )

    # ── Tools ──────────────────────────────────────────────────────────────

    @agent.tool
    async def get_diagram_context(ctx) -> dict[str, Any]:
        """Get all elements and data flows in the current diagram."""
        from app.models import Diagram as DiagramModel
        diagram = ctx.deps.db.query(DiagramModel).filter(
            DiagramModel.id == ctx.deps.diagram_id
        ).first()
        if not diagram:
            return {"error": "Diagram not found"}

        data = diagram.diagram_data or {}
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])

        node_labels: dict[str, str] = {
            n.get("id", ""): n.get("data", {}).get("label", n.get("id", ""))
            for n in nodes
        }

        elements = [
            {
                "id": n.get("id"),
                "label": n.get("data", {}).get("label", "Unnamed"),
                "type": n.get("data", {}).get("type", "unknown"),
            }
            for n in nodes
            if n.get("data", {}).get("type") != "boundary"
        ]
        boundaries = [n.get("data", {}).get("label", "Boundary") for n in nodes
                      if n.get("data", {}).get("type") == "boundary"]

        flows = [
            {
                "id": e.get("id"),
                "from": e.get("source", ""),
                "from_label": node_labels.get(e.get("source", ""), e.get("source", "")),
                "to": e.get("target", ""),
                "to_label": node_labels.get(e.get("target", ""), e.get("target", "")),
                "label": e.get("data", {}).get("label") or e.get("label") or "Data Flow",
            }
            for e in edges
        ]

        return {
            "diagram_name": diagram.name,
            "elements": elements,
            "trust_boundaries": boundaries,
            "data_flows": flows,
        }

    @agent.tool
    async def get_existing_diagram_analysis(ctx) -> dict[str, Any]:
        """Return all threats and mitigations ALREADY attached to this diagram's elements.
        Call this FIRST so you do not re-propose anything that already exists."""
        from app.models import DiagramThreat, DiagramMitigation, Threat, Mitigation

        existing_threats = ctx.deps.db.query(DiagramThreat).filter(
            DiagramThreat.diagram_id == ctx.deps.diagram_id
        ).all()
        existing_mits = ctx.deps.db.query(DiagramMitigation).filter(
            DiagramMitigation.diagram_id == ctx.deps.diagram_id
        ).all()

        # Also include approved proposals from previous messages in this conversation
        from app.models.ai import AIMessage
        prev_msgs = ctx.deps.db.query(AIMessage).filter(
            AIMessage.conversation_id == ctx.deps.conversation_id,
            AIMessage.role == "assistant"
        ).all()
        prev_threat_keys: set[tuple] = set()
        prev_mit_keys: set[tuple] = set()
        for msg in prev_msgs:
            for p in (msg.proposals or []):
                if p.get("status") in ("pending", "approved"):
                    if p.get("type") == "threat":
                        prev_threat_keys.add((p.get("element_id"), p.get("threat_id")))
                    else:
                        prev_mit_keys.add((p.get("element_id"), p.get("mitigation_id")))

        # Bulk-load threat/mitigation names to avoid N+1 queries
        threat_ids = {dt.threat_id for dt in existing_threats}
        mit_ids = {dm.mitigation_id for dm in existing_mits}
        threat_map = {t.id: t for t in ctx.deps.db.query(Threat).filter(Threat.id.in_(threat_ids)).all()} if threat_ids else {}
        mit_map = {m.id: m for m in ctx.deps.db.query(Mitigation).filter(Mitigation.id.in_(mit_ids)).all()} if mit_ids else {}

        # Build element label map from diagram data for display
        element_label_map: dict[str, str] = {}
        from app.models import Diagram as DiagramModel
        diagram = ctx.deps.db.query(DiagramModel).filter(
            DiagramModel.id == ctx.deps.diagram_id
        ).first()
        if diagram and diagram.diagram_data:
            for n in diagram.diagram_data.get("nodes", []):
                nid = n.get("id", "")
                element_label_map[nid] = n.get("data", {}).get("label") or nid
            for e in diagram.diagram_data.get("edges", []):
                eid = e.get("id", "")
                element_label_map[eid] = e.get("data", {}).get("label") or e.get("label") or eid

        threats_by_element: dict[str, list[dict]] = {}
        for dt in existing_threats:
            t = threat_map.get(dt.threat_id)
            entry: dict[str, Any] = {
                "diagram_threat_id": dt.id,
                "threat_id": dt.threat_id,
                "name": t.name if t else f"Threat #{dt.threat_id}",
                "element": element_label_map.get(dt.element_id, dt.element_id),
                "status": dt.status,
            }
            if dt.likelihood is not None:
                entry["likelihood"] = dt.likelihood
                entry["impact"] = dt.impact
                entry["severity"] = dt.severity
            threats_by_element.setdefault(dt.element_id, []).append(entry)

        mits_by_element: dict[str, list[dict]] = {}
        for dm in existing_mits:
            m = mit_map.get(dm.mitigation_id)
            mits_by_element.setdefault(dm.element_id, []).append({
                "diagram_mitigation_id": dm.id,
                "mitigation_id": dm.mitigation_id,
                "name": m.name if m else f"Mitigation #{dm.mitigation_id}",
                "status": dm.status,
            })

        return {
            "existing_threats": threats_by_element,
            "existing_mitigations": mits_by_element,
            "pending_proposals": {
                "threats": [list(k) for k in prev_threat_keys],
                "mitigations": [list(k) for k in prev_mit_keys],
            },
        }

    @agent.tool
    async def get_knowledge_base_threats(ctx) -> list[dict[str, Any]]:
        """Load all threats from the knowledge base for the active framework.
        Call this once before proposing any threats."""
        from app.models import Threat
        from app.services.redis_cache import cache

        cache_key = f"kb:threats:{ctx.deps.framework_id}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        query = ctx.deps.db.query(Threat).filter(Threat.is_custom == False)
        if ctx.deps.framework_id:
            query = query.filter(Threat.framework_id == ctx.deps.framework_id)

        threats = [
            {"id": t.id, "name": t.name, "category": t.category}
            for t in query.all()
        ]
        await cache.set(cache_key, threats, ttl=300)
        return threats

    @agent.tool
    async def get_knowledge_base_mitigations(ctx) -> list[dict[str, Any]]:
        """Load all mitigations from the knowledge base for the active framework.
        Call this once before proposing any mitigations."""
        from app.models import Mitigation
        from app.services.redis_cache import cache

        cache_key = f"kb:mitigations:{ctx.deps.framework_id}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        query = ctx.deps.db.query(Mitigation).filter(Mitigation.is_custom == False)
        if ctx.deps.framework_id:
            query = query.filter(Mitigation.framework_id == ctx.deps.framework_id)

        mitigations = [
            {"id": m.id, "name": m.name, "category": m.category}
            for m in query.all()
        ]
        await cache.set(cache_key, mitigations, ttl=300)
        return mitigations

    def _get_element_label(ctx, element_id: str) -> str:
        """Look up the display name of a diagram element or edge by its ID."""
        from app.models import Diagram as DiagramModel
        diagram = ctx.deps.db.query(DiagramModel).filter(
            DiagramModel.id == ctx.deps.diagram_id
        ).first()
        if diagram and diagram.diagram_data:
            for node in diagram.diagram_data.get("nodes", []):
                if node.get("id") == element_id:
                    return node.get("data", {}).get("label") or element_id
            for edge in diagram.diagram_data.get("edges", []):
                if edge.get("id") == element_id:
                    # Edge label: use explicit label, or "Source → Target"
                    lbl = edge.get("data", {}).get("label") or edge.get("label")
                    if lbl:
                        return lbl
                    src = edge.get("source", "")
                    tgt = edge.get("target", "")
                    # Resolve node labels for src/tgt
                    node_map = {n.get("id"): n.get("data", {}).get("label", n.get("id"))
                                for n in diagram.diagram_data.get("nodes", [])}
                    return f"{node_map.get(src, src)} → {node_map.get(tgt, tgt)}"
        return element_id

    @agent.tool
    async def propose_threat(
        ctx,
        element_id: str,
        element_type: str,
        threat_id: int,
        reasoning: str,
        likelihood: int | None = None,
        impact: int | None = None,
    ) -> str:
        """Register a threat proposal for the user to review and approve.
        Do NOT set likelihood/impact during regular threat analysis — only set them when the
        user explicitly requests risk scoring."""
        # ── Hard deduplication ──────────────────────────────────────────────
        from app.models import DiagramThreat, Threat
        already_in_diagram = ctx.deps.db.query(DiagramThreat).filter(
            DiagramThreat.diagram_id == ctx.deps.diagram_id,
            DiagramThreat.element_id == element_id,
            DiagramThreat.threat_id == threat_id,
        ).first()
        if already_in_diagram:
            return f"Skipped — threat #{threat_id} already exists on {element_id}"

        # Check previous conversation proposals (pending or approved)
        from app.models.ai import AIMessage
        for msg in ctx.deps.db.query(AIMessage).filter(
            AIMessage.conversation_id == ctx.deps.conversation_id
        ).all():
            for p in (msg.proposals or []):
                if (p.get("type") == "threat" and
                        p.get("element_id") == element_id and
                        p.get("threat_id") == threat_id and
                        p.get("status") in ("pending", "approved")):
                    return f"Skipped — threat #{threat_id} already proposed for {element_id}"

        # Check current session's in-memory proposals
        if any(p["type"] == "threat" and p["element_id"] == element_id and p["threat_id"] == threat_id
               for p in ctx.deps.proposals):
            return f"Skipped — threat #{threat_id} already proposed in this response"

        risk_score = (likelihood * impact) if (likelihood and impact) else None
        severity: str | None = None
        if risk_score is not None:
            if risk_score <= 5: severity = "low"
            elif risk_score <= 12: severity = "medium"
            elif risk_score <= 19: severity = "high"
            else: severity = "critical"

        proposal_id = f"prop_t_{uuid.uuid4().hex[:8]}"
        threat = ctx.deps.db.query(Threat).filter(Threat.id == threat_id).first()
        ctx.deps.proposals.append({
            "id": proposal_id,
            "type": "threat",
            "element_id": element_id,
            "element_type": element_type,
            "element_label": _get_element_label(ctx, element_id),
            "threat_id": threat_id,
            "name": threat.name if threat else f"Threat #{threat_id}",
            "description": threat.description if threat else "",
            "category": threat.category if threat else None,
            "model_id": ctx.deps.model_id,
            "reasoning": reasoning,
            "likelihood": likelihood,
            "impact": impact,
            "risk_score": risk_score,
            "severity": severity,
            "status": "pending",
        })
        return f"Threat proposal '{threat.name if threat else threat_id}' registered as {proposal_id}"

    @agent.tool
    async def propose_mitigation(
        ctx,
        element_id: str,
        element_type: str,
        mitigation_id: int,
        reasoning: str,
        for_threat_proposal_id: str = "",
    ) -> str:
        """Register a mitigation proposal. Set for_threat_proposal_id to the ID of the
        threat proposal this mitigation addresses (from the return value of propose_threat)."""
        # ── Hard deduplication ──────────────────────────────────────────────
        from app.models import DiagramMitigation, Mitigation
        already_in_diagram = ctx.deps.db.query(DiagramMitigation).filter(
            DiagramMitigation.diagram_id == ctx.deps.diagram_id,
            DiagramMitigation.element_id == element_id,
            DiagramMitigation.mitigation_id == mitigation_id,
        ).first()
        if already_in_diagram:
            return f"Skipped — mitigation #{mitigation_id} already exists on {element_id}"

        from app.models.ai import AIMessage
        for msg in ctx.deps.db.query(AIMessage).filter(
            AIMessage.conversation_id == ctx.deps.conversation_id
        ).all():
            for p in (msg.proposals or []):
                if (p.get("type") == "mitigation" and
                        p.get("element_id") == element_id and
                        p.get("mitigation_id") == mitigation_id and
                        p.get("status") in ("pending", "approved")):
                    return f"Skipped — mitigation #{mitigation_id} already proposed for {element_id}"

        if any(p["type"] == "mitigation" and p["element_id"] == element_id and p["mitigation_id"] == mitigation_id
               for p in ctx.deps.proposals):
            return f"Skipped — mitigation #{mitigation_id} already proposed in this response"

        proposal_id = f"prop_m_{uuid.uuid4().hex[:8]}"
        from app.models import Mitigation
        mit = ctx.deps.db.query(Mitigation).filter(Mitigation.id == mitigation_id).first()

        # Resolve the KB threat_id from the linked threat proposal so we can set
        # DiagramMitigation.threat_id when this proposal is approved.
        linked_threat_kb_id: int | None = None
        if for_threat_proposal_id:
            for p in ctx.deps.proposals:
                if p.get("id") == for_threat_proposal_id and p.get("type") == "threat":
                    linked_threat_kb_id = p.get("threat_id")
                    break

        ctx.deps.proposals.append({
            "id": proposal_id,
            "type": "mitigation",
            "element_id": element_id,
            "element_type": element_type,
            "element_label": _get_element_label(ctx, element_id),
            "mitigation_id": mitigation_id,
            "name": mit.name if mit else f"Mitigation #{mitigation_id}",
            "description": mit.description if mit else "",
            "category": mit.category if mit else None,
            "model_id": ctx.deps.model_id,
            "reasoning": reasoning,
            "for_threat_proposal_id": for_threat_proposal_id or None,
            "linked_threat_kb_id": linked_threat_kb_id,
            "status": "pending",
        })
        return f"Mitigation proposal '{mit.name if mit else mitigation_id}' registered as {proposal_id}"

    @agent.tool
    async def get_available_frameworks(ctx) -> list[dict[str, Any]]:
        """List all available threat modeling frameworks (e.g. STRIDE, OWASP, LINDDUN).
        Call this when model_id is None to choose a framework before proposing model creation."""
        from app.models import Framework
        frameworks = ctx.deps.db.query(Framework).all()
        return [
            {"id": f.id, "name": f.name, "description": getattr(f, "description", None)}
            for f in frameworks
        ]

    @agent.tool
    async def propose_create_model(
        ctx,
        framework_id: int,
        model_name: str,
        reasoning: str,
    ) -> str:
        """Propose creating a threat model container for this diagram with the given framework.
        Only call this when model_id is None. Threats and mitigations proposed afterward will be
        linked to this model once the user approves it."""
        from app.models import Framework
        from app.models.model import Model as ModelTable

        # If a model already exists for this framework, use it instead
        existing = ctx.deps.db.query(ModelTable).filter(
            ModelTable.diagram_id == ctx.deps.diagram_id,
            ModelTable.framework_id == framework_id,
        ).first()
        if existing:
            ctx.deps.model_id = existing.id
            return f"A model for this framework already exists (id={existing.id}). Using it for analysis."

        # Avoid double-proposing
        if any(
            p.get("type") == "create_model" and p.get("framework_id") == framework_id
            for p in ctx.deps.proposals
        ):
            return "Model creation for this framework is already proposed."

        framework = ctx.deps.db.query(Framework).filter(Framework.id == framework_id).first()
        if not framework:
            return f"Framework {framework_id} not found."

        proposal_id = f"prop_mdl_{uuid.uuid4().hex[:8]}"
        ctx.deps.proposals.append({
            "id": proposal_id,
            "type": "create_model",
            "element_id": "__model__",
            "element_type": "model",
            "element_label": model_name,
            "framework_id": framework_id,
            "framework_name": framework.name,
            "name": model_name,
            "description": f"Create a {framework.name} threat model for this diagram.",
            "reasoning": reasoning,
            "status": "pending",
        })
        return (
            f"Model creation proposal '{model_name}' ({framework.name}) registered as {proposal_id}. "
            "Continuing with analysis — threats and mitigations will be linked to this model upon approval."
        )

    @agent.tool
    async def propose_custom_threat(
        ctx,
        element_id: str,
        element_type: str,
        name: str,
        description: str,
        category: str,
        reasoning: str,
        likelihood: int | None = None,
        impact: int | None = None,
    ) -> str:
        """Suggest a NEW threat that is not in the knowledge base.
        Use this ONLY when you have identified a relevant, specific threat that the KB lacks.
        The user will be asked to approve both adding it to the KB and applying it to the diagram.
        Do NOT set likelihood/impact unless the user has explicitly requested risk scoring."""
        # Avoid proposing if the same custom threat name already exists in the session
        if any(
            p.get("type") == "suggest_kb_threat" and
            p.get("element_id") == element_id and
            p.get("name", "").lower() == name.lower()
            for p in ctx.deps.proposals
        ):
            return f"Skipped — custom threat '{name}' already proposed for {element_id}"

        risk_score = (likelihood * impact) if (likelihood and impact) else None
        severity: str | None = None
        if risk_score is not None:
            if risk_score <= 5: severity = "low"
            elif risk_score <= 12: severity = "medium"
            elif risk_score <= 19: severity = "high"
        else:
            severity = "critical"

        proposal_id = f"prop_ct_{uuid.uuid4().hex[:8]}"
        ctx.deps.proposals.append({
            "id": proposal_id,
            "type": "suggest_kb_threat",
            "element_id": element_id,
            "element_type": element_type,
            "element_label": _get_element_label(ctx, element_id),
            "name": name,
            "description": description,
            "category": category,
            "framework_id": ctx.deps.framework_id,
            "model_id": ctx.deps.model_id,
            "reasoning": reasoning,
            "likelihood": likelihood,
            "impact": impact,
            "risk_score": risk_score,
            "severity": severity,
            "status": "pending",
        })
        return f"Custom threat suggestion '{name}' registered as {proposal_id} (will add to KB on approval)"

    @agent.tool
    async def propose_custom_mitigation(
        ctx,
        element_id: str,
        element_type: str,
        name: str,
        description: str,
        category: str,
        reasoning: str,
        for_threat_proposal_id: str = "",
    ) -> str:
        """Suggest a NEW mitigation that is not in the knowledge base.
        Use this ONLY when you have identified a relevant mitigation the KB lacks.
        The user will be asked to approve both adding it to the KB and applying it to the diagram."""
        if any(
            p.get("type") == "suggest_kb_mitigation" and
            p.get("element_id") == element_id and
            p.get("name", "").lower() == name.lower()
            for p in ctx.deps.proposals
        ):
            return f"Skipped — custom mitigation '{name}' already proposed for {element_id}"

        # Resolve linked threat KB ID from in-memory proposals
        linked_threat_kb_id: int | None = None
        if for_threat_proposal_id:
            for p in ctx.deps.proposals:
                if p.get("id") == for_threat_proposal_id:
                    linked_threat_kb_id = p.get("threat_id")
                    break

        proposal_id = f"prop_cm_{uuid.uuid4().hex[:8]}"
        ctx.deps.proposals.append({
            "id": proposal_id,
            "type": "suggest_kb_mitigation",
            "element_id": element_id,
            "element_type": element_type,
            "element_label": _get_element_label(ctx, element_id),
            "name": name,
            "description": description,
            "category": category,
            "framework_id": ctx.deps.framework_id,
            "model_id": ctx.deps.model_id,
            "reasoning": reasoning,
            "for_threat_proposal_id": for_threat_proposal_id or None,
            "linked_threat_kb_id": linked_threat_kb_id,
            "status": "pending",
        })
        return f"Custom mitigation suggestion '{name}' registered as {proposal_id} (will add to KB on approval)"

    @agent.tool
    async def propose_risk_update(
        ctx,
        diagram_threat_id: int,
        threat_name: str,
        likelihood: int,
        impact: int,
        reasoning: str,
    ) -> str:
        """Update the risk score of an EXISTING threat already on the diagram.
        Use diagram_threat_id from get_existing_diagram_analysis.
        Set likelihood (1-5) and impact (1-5); severity and risk_score are computed automatically."""
        from app.models import DiagramThreat

        # Validate the threat belongs to this diagram
        dt = ctx.deps.db.query(DiagramThreat).filter(
            DiagramThreat.id == diagram_threat_id,
            DiagramThreat.diagram_id == ctx.deps.diagram_id,
        ).first()
        if not dt:
            return f"Error: DiagramThreat #{diagram_threat_id} not found on this diagram"

        # Avoid duplicate update proposals in this session
        if any(
            p.get("type") == "update_risk" and p.get("diagram_threat_id") == diagram_threat_id
            for p in ctx.deps.proposals
        ):
            return f"Skipped — risk update for threat #{diagram_threat_id} already proposed"

        likelihood = max(1, min(5, likelihood))
        impact = max(1, min(5, impact))
        risk_score = likelihood * impact
        if risk_score <= 5:
            severity = "low"
        elif risk_score <= 12:
            severity = "medium"
        elif risk_score <= 19:
            severity = "high"
        else:
            severity = "critical"

        resolved_label = _get_element_label(ctx, dt.element_id)
        proposal_id = f"prop_ru_{uuid.uuid4().hex[:8]}"
        ctx.deps.proposals.append({
            "id": proposal_id,
            "type": "update_risk",
            "element_id": dt.element_id,
            "element_type": dt.element_type or "process",
            "element_label": resolved_label,
            "diagram_threat_id": diagram_threat_id,
            "name": threat_name,
            "description": f"Set risk: Likelihood {likelihood}/5 × Impact {impact}/5 = {risk_score} ({severity})",
            "likelihood": likelihood,
            "impact": impact,
            "risk_score": risk_score,
            "severity": severity,
            "reasoning": reasoning,
            "status": "pending",
        })
        return f"Risk update proposal for '{threat_name}' registered as {proposal_id} (L={likelihood}, I={impact}, score={risk_score}, {severity})"

    @agent.tool
    async def propose_removal(
        ctx,
        item_type: str,
        diagram_item_id: int,
        element_id: str,
        name: str,
        reasoning: str,
    ) -> str:
        """Propose removing an EXISTING threat or mitigation from the diagram.
        item_type must be 'threat' or 'mitigation'.
        diagram_item_id is the 'diagram_threat_id' or 'diagram_mitigation_id' from get_existing_diagram_analysis.
        Only call this when the existing item is clearly a duplicate or no longer relevant."""
        if item_type not in ("threat", "mitigation"):
            return "Error: item_type must be 'threat' or 'mitigation'"

        # Check if already proposed for removal in this session
        if any(
            p.get("type") == f"remove_{item_type}" and p.get("diagram_item_id") == diagram_item_id
            for p in ctx.deps.proposals
        ):
            return f"Skipped — removal of {item_type} #{diagram_item_id} already proposed"

        proposal_id = f"prop_rem_{uuid.uuid4().hex[:8]}"
        ctx.deps.proposals.append({
            "id": proposal_id,
            "type": f"remove_{item_type}",
            "element_id": element_id,
            "element_label": _get_element_label(ctx, element_id),
            "element_type": "unknown",
            "diagram_item_id": diagram_item_id,
            "name": name,
            "description": f"Remove existing {item_type} from this element.",
            "reasoning": reasoning,
            "status": "pending",
        })
        return f"Removal proposal for {item_type} '{name}' registered as {proposal_id}"

    return agent
