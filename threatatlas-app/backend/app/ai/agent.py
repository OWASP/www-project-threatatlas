"""
Pydantic-AI agent for threat modeling analysis.

The agent is constructed per-request so that AI config changes take effect
immediately without any cache invalidation.
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Annotated, Any

from pydantic import BaseModel as _PydanticModel, BeforeValidator
from sqlalchemy.orm import Session

# pydantic-ai 1.x validates tool args strictly; models often send integers as
# floats (e.g. 42.0).  This alias coerces any numeric value to a plain int.
CoercedInt = Annotated[int, BeforeValidator(lambda v: int(v) if v is not None else v)]


# ── Batch proposal item schemas (module-level so pydantic-ai can resolve them) ─

class _ThreatBatchItem(_PydanticModel):
    element_id: str
    element_type: str
    threat_id: CoercedInt
    reasoning: str
    confidence: str = "medium"  # "low" | "medium" | "high"
    model_proposal_id: str = ""


class _MitigationBatchItem(_PydanticModel):
    element_id: str
    element_type: str
    mitigation_id: CoercedInt
    reasoning: str
    confidence: str = "medium"  # "low" | "medium" | "high"
    for_threat_proposal_id: str = ""
    model_proposal_id: str = ""

from app.ai.encryption import decrypt_api_key
from app.models.ai import AIConfig

SYSTEM_PROMPT = """You are a senior application security engineer performing structured threat modeling on Data Flow Diagrams (DFDs).
You apply STRIDE, OWASP Top 10, LINDDUN, and any other framework loaded from the knowledge base.

## Conversational behaviour
Respond naturally to greetings and general questions. Only run the analysis workflow when the user
clearly requests a threat analysis, security review, or risk assessment. Ask one focused clarifying
question if the intent is ambiguous (e.g. "Which framework should I use?" or "Focus on data flows or all elements?").

## CRITICAL: Framework / model alignment — check this BEFORE every analysis:

The active model_id and framework_id you receive at startup reflect whatever the user had selected in the UI
at the time they sent the message — NOT necessarily the framework they are requesting in their message.

**Framework identity rule**: If the user's message explicitly names a framework (e.g. "OWASP Top 10",
"STRIDE", "PASTA", "LINDDUN", "OWASP LLM") you MUST use EXACTLY that framework. Never substitute a
"similar" or "better-fitting" framework for one the user already named — that is a correctness violation.

Before starting any analysis:
  a. Call `get_models_for_diagram` to see every model that exists for this diagram (with framework names).
  b. Determine which framework(s) the user is asking for. If they named one explicitly, that name is final.
  c. For EACH requested framework:
     - If it IS the active model: proceed normally (no model_proposal_id needed).
     - If it EXISTS but is NOT active: call `switch_model_context(model_id=<id>)` to switch to it,
       then proceed. Tell the user: "Switching to the [Framework] model for this analysis."
     - If NO model exists for the requested framework: call `propose_create_model` and note the
       [model_proposal_id=...] value in its response — you MUST pass this as `model_proposal_id`
       to every propose_threat / propose_mitigation call that belongs to this framework.
  d. NEVER save threats or mitigations to a model whose framework does not match the requested analysis.
     This is the most important rule — framework mismatch corrupts the threat model.

## CRITICAL: Multi-framework ordering rule — read before doing any multi-framework analysis:

When the user requests two or more frameworks (e.g. "do STRIDE and OWASP"), you MUST follow this
exact interleaved sequence — NEVER create all models first:

  1. call propose_create_model for framework A → capture [model_proposal_id=AAA]
  2. propose ALL threats + mitigations for framework A, each with model_proposal_id="AAA"
  3. call propose_create_model for framework B → capture [model_proposal_id=BBB]
  4. propose ALL threats + mitigations for framework B, each with model_proposal_id="BBB"

Creating all models upfront then proposing threats loses the per-model link. The explicit
model_proposal_id parameter on each propose_threat / propose_mitigation call is what binds
proposals to the correct model at approval time.

## Analysis workflow — run for every security analysis request:

STEP -1 (only if model_id is None):
  Call `get_available_frameworks`.
  Framework selection — strict priority order:
    1. If the user explicitly named a framework in their message (e.g. "OWASP Top 10", "STRIDE",
       "PASTA", "LINDDUN") → use EXACTLY that framework. No substitution, no "better fit" override.
    2. If the user described a context without naming a framework → pick the best fit:
       web/API/mobile context → OWASP Top 10; general architecture → STRIDE.
    3. Only fall back to STRIDE when no context clue exists.
  Call `propose_create_model` with `framework_name` set to the EXACT name string from get_available_frameworks
  (e.g. "OWASP Top 10", "STRIDE"). Never pass an ID — use the name.
  Tell the user which framework you are using and, if you inferred it, why.

STEP 0  Call `get_existing_diagram_analysis`. Build a mental map of what is already covered.
        Never re-propose an existing threat/mitigation.

STEP 1  Call `get_diagram_context`. Note: element types, labels, trust-boundary crossings, and
        what data flows between which elements — these drive which threats apply.

STEP 2  Call `get_knowledge_base_threats`.
STEP 3  Call `get_knowledge_base_mitigations`.

STEP 4  Analyse every non-boundary element and every data flow edge.
        a. Determine the top 3 most relevant KB threats per element (consider element type,
           data sensitivity, and trust-boundary crossings).
        b. Call `propose_threats_batch` ONCE with ALL threat proposals across ALL elements
           (pass the full list in one call). Do NOT call propose_threat in a loop — batching
           is required for performance.
           - reasoning: 1 sentence max per item, specific to the element.
           - Do NOT include likelihood/impact — that is a separate user request.
        c. Call `propose_custom_threat` ONLY for important threats genuinely absent from the KB.

STEP 5  After step 4, call `propose_mitigations_batch` ONCE with ALL mitigation proposals across
        ALL elements. Use for_threat_proposal_id to link mitigations to the threat proposals from step 4.
        Top 2 mitigations per threat maximum. Add `propose_custom_mitigation` only if truly needed.

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

## Confidence scoring (required on every threat and mitigation proposal):
Set `confidence` to one of:
- "high"   — You are certain this threat/mitigation applies given the element type, data sensitivity, and visible data flows.
- "medium" — This threat/mitigation very likely applies but may depend on implementation details not visible in the diagram.
- "low"    — This threat/mitigation may apply but requires investigation to confirm (e.g. unclear data sensitivity or ambiguous flows).
Default to "medium" when unsure.

## Executive summary:
When the user asks for an executive summary, write 3-5 concise sentences in plain, non-technical language
covering: overall risk posture, the most critical threat area, mitigation coverage, and one clear recommendation.
Do NOT call any tools for this — derive it from the existing analysis context.
"""


@dataclass
class AgentDeps:
    db: Session
    diagram_id: int
    conversation_id: int
    model_id: int | None
    framework_id: int | None
    proposals: list[dict[str, Any]] = field(default_factory=list)
    events_queue: asyncio.Queue | None = field(default=None)
    # Tracks the ID of the most recent propose_create_model proposal so that
    # subsequent threat/mitigation proposals can be explicitly linked to it.
    # The approval handler uses this to patch model_id onto linked proposals
    # when the create_model proposal is approved — enabling correct multi-framework
    # linking even when multiple frameworks are proposed in one response.
    pending_model_proposal_id: str | None = field(default=None)


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
        retries=3,  # pydantic-ai 1.x: allow 3 retries on tool argument validation failures
    )

    # ── Tools ──────────────────────────────────────────────────────────────

    async def _emit(ctx, message: str) -> None:
        if ctx.deps.events_queue is not None:
            await ctx.deps.events_queue.put({"thinking": message})

    @agent.tool
    async def get_diagram_context(ctx) -> dict[str, Any]:
        """Get all elements and data flows in the current diagram."""
        await _emit(ctx, "Reading diagram structure…")
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
        await _emit(ctx, "Checking existing analysis…")
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
        await _emit(ctx, "Loading threat knowledge base…")
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
        await _emit(ctx, "Loading mitigation knowledge base…")
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

    @agent.tool(retries=3)
    async def propose_threat(
        ctx,
        element_id: str,
        element_type: str,
        threat_id: int,
        reasoning: str,
        confidence: str = "medium",
        model_proposal_id: str = "",
        likelihood: int | None = None,
        impact: int | None = None,
    ) -> str:
        """Register a threat proposal for the user to review and approve.
        Set confidence to "high", "medium", or "low" based on how certain you are this threat applies.
        Set model_proposal_id to the [model_proposal_id=...] value returned by propose_create_model
        when this threat belongs to a model that is pending creation (multi-framework analysis).
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

        await _emit(ctx, f"Proposing threat #{threat_id} on {element_type} '{element_id}'…")
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
            "pending_model_proposal_id": model_proposal_id or ctx.deps.pending_model_proposal_id,
            "reasoning": reasoning,
            "confidence": confidence if confidence in ("low", "medium", "high") else "medium",
            "likelihood": likelihood,
            "impact": impact,
            "risk_score": risk_score,
            "severity": severity,
            "status": "pending",
        })
        return f"Threat proposal '{threat.name if threat else threat_id}' registered as {proposal_id}"

    @agent.tool(retries=3)
    async def propose_mitigation(
        ctx,
        element_id: str,
        element_type: str,
        mitigation_id: int,
        reasoning: str,
        confidence: str = "medium",
        for_threat_proposal_id: str = "",
        model_proposal_id: str = "",
    ) -> str:
        """Register a mitigation proposal. Set confidence to "high", "medium", or "low".
        Set for_threat_proposal_id to the ID of the threat proposal this mitigation addresses.
        Set model_proposal_id to the [model_proposal_id=...] value from propose_create_model
        when this mitigation belongs to a model that is pending creation (multi-framework analysis)."""
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

        await _emit(ctx, f"Proposing mitigation #{mitigation_id} on '{element_id}'…")
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
            "pending_model_proposal_id": model_proposal_id or ctx.deps.pending_model_proposal_id,
            "reasoning": reasoning,
            "confidence": confidence if confidence in ("low", "medium", "high") else "medium",
            "for_threat_proposal_id": for_threat_proposal_id or None,
            "linked_threat_kb_id": linked_threat_kb_id,
            "status": "pending",
        })
        return f"Mitigation proposal '{mit.name if mit else mitigation_id}' registered as {proposal_id}"

    @agent.tool
    async def get_available_frameworks(ctx) -> list[dict[str, Any]]:
        """List all available threat modeling frameworks (e.g. STRIDE, OWASP, LINDDUN).
        Call this when model_id is None to choose a framework before proposing model creation."""
        await _emit(ctx, "Loading available frameworks…")
        from app.models import Framework
        frameworks = ctx.deps.db.query(Framework).all()
        return [
            {"id": f.id, "name": f.name, "description": getattr(f, "description", None)}
            for f in frameworks
        ]

    @agent.tool(retries=3)
    async def propose_create_model(
        ctx,
        framework_name: str,
        model_name: str,
        reasoning: str,
    ) -> str:
        """Propose creating a threat model container for this diagram.

        IMPORTANT: Pass `framework_name` as the EXACT name string returned by
        get_available_frameworks (e.g. "OWASP Top 10", "STRIDE", "PASTA").
        Do NOT pass a numeric ID — the name is the authoritative selector and
        eliminates any risk of picking the wrong framework.

        Only call this when no model exists for the requested framework.
        Threats and mitigations proposed afterward will be linked to this model
        once the user approves it.
        """
        await _emit(ctx, f"Creating threat model '{model_name}'…")
        from app.models import Framework
        from app.models.model import Model as ModelTable

        # Look up framework by name (case-insensitive, partial match allowed)
        all_frameworks = ctx.deps.db.query(Framework).all()
        framework = next(
            (f for f in all_frameworks if f.name.lower() == framework_name.lower()),
            None,
        )
        if not framework:
            # Fallback: partial match
            framework = next(
                (f for f in all_frameworks if framework_name.lower() in f.name.lower() or f.name.lower() in framework_name.lower()),
                None,
            )
        if not framework:
            available = ", ".join(f.name for f in all_frameworks)
            return f"Framework '{framework_name}' not found. Available: {available}. Use the exact name."

        framework_id = framework.id

        # If a model already exists for this framework, use it instead
        existing = ctx.deps.db.query(ModelTable).filter(
            ModelTable.diagram_id == ctx.deps.diagram_id,
            ModelTable.framework_id == framework_id,
        ).first()
        if existing:
            ctx.deps.model_id = existing.id
            return f"A model for framework '{framework.name}' already exists (id={existing.id}). Using it for analysis."

        # Avoid double-proposing
        if any(
            p.get("type") == "create_model" and p.get("framework_id") == framework_id
            for p in ctx.deps.proposals
        ):
            return f"Model creation for '{framework.name}' is already proposed."

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
        # Clear model_id so subsequent proposals carry model_id=None.
        # Record the proposal_id so threats/mitigations can be implicitly linked.
        ctx.deps.model_id = None
        ctx.deps.framework_id = framework_id
        ctx.deps.pending_model_proposal_id = proposal_id
        return (
            f"[model_proposal_id={proposal_id}] "
            f"Model creation proposal '{model_name}' ({framework.name}) queued for approval. "
            f"You MUST pass model_proposal_id=\"{proposal_id}\" to every propose_threat and "
            f"propose_mitigation call that belongs to this {framework.name} analysis."
        )

    @agent.tool(retries=3)
    async def propose_custom_threat(
        ctx,
        element_id: str,
        element_type: str,
        name: str,
        description: str,
        category: str,
        reasoning: str,
        model_proposal_id: str = "",
        likelihood: int | None = None,
        impact: int | None = None,
    ) -> str:
        """Suggest a NEW threat that is not in the knowledge base.
        Use this ONLY when you have identified a relevant, specific threat that the KB lacks.
        The user will be asked to approve both adding it to the KB and applying it to the diagram.
        Set model_proposal_id when this custom threat belongs to a pending model creation (multi-framework).
        Do NOT set likelihood/impact unless the user has explicitly requested risk scoring."""
        # Avoid proposing if the same custom threat name already exists in the session
        if any(
            p.get("type") == "suggest_kb_threat" and
            p.get("element_id") == element_id and
            p.get("name", "").lower() == name.lower()
            for p in ctx.deps.proposals
        ):
            return f"Skipped — custom threat '{name}' already proposed for {element_id}"

        await _emit(ctx, f"Proposing new threat: {name}…")
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
            "pending_model_proposal_id": model_proposal_id or ctx.deps.pending_model_proposal_id,
            "reasoning": reasoning,
            "likelihood": likelihood,
            "impact": impact,
            "risk_score": risk_score,
            "severity": severity,
            "status": "pending",
        })
        return f"Custom threat suggestion '{name}' registered as {proposal_id} (will add to KB on approval)"

    @agent.tool(retries=3)
    async def propose_custom_mitigation(
        ctx,
        element_id: str,
        element_type: str,
        name: str,
        description: str,
        category: str,
        reasoning: str,
        for_threat_proposal_id: str = "",
        model_proposal_id: str = "",
    ) -> str:
        """Suggest a NEW mitigation that is not in the knowledge base.
        Use this ONLY when you have identified a relevant mitigation the KB lacks.
        The user will be asked to approve both adding it to the KB and applying it to the diagram.
        Set model_proposal_id when this custom mitigation belongs to a pending model creation (multi-framework)."""
        if any(
            p.get("type") == "suggest_kb_mitigation" and
            p.get("element_id") == element_id and
            p.get("name", "").lower() == name.lower()
            for p in ctx.deps.proposals
        ):
            return f"Skipped — custom mitigation '{name}' already proposed for {element_id}"

        await _emit(ctx, f"Proposing new mitigation: {name}…")
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
            "pending_model_proposal_id": model_proposal_id or ctx.deps.pending_model_proposal_id,
            "reasoning": reasoning,
            "for_threat_proposal_id": for_threat_proposal_id or None,
            "linked_threat_kb_id": linked_threat_kb_id,
            "status": "pending",
        })
        return f"Custom mitigation suggestion '{name}' registered as {proposal_id} (will add to KB on approval)"

    @agent.tool(retries=3)
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

        await _emit(ctx, f"Scoring risk for '{threat_name}'…")
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

    @agent.tool(retries=3)
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

        await _emit(ctx, f"Proposing removal of {item_type} '{name}'…")
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

    @agent.tool(retries=3)
    async def propose_threats_batch(ctx, items: list[_ThreatBatchItem]) -> str:
        """Propose multiple threats in ONE call — mandatory for efficiency.
        Use this instead of calling propose_threat in a loop.
        Pass ALL threat proposals for the entire diagram at once."""
        if not items:
            return "No threat items provided — nothing to propose."
        from app.models import DiagramThreat, Threat
        from app.models.ai import AIMessage

        threat_ids = {item.threat_id for item in items}
        threat_map = {
            t.id: t for t in ctx.deps.db.query(Threat).filter(Threat.id.in_(threat_ids)).all()
        } if threat_ids else {}

        # Pre-load existing threats for deduplication
        existing_pairs: set[tuple] = set()
        for dt in ctx.deps.db.query(DiagramThreat).filter(
            DiagramThreat.diagram_id == ctx.deps.diagram_id
        ).all():
            existing_pairs.add((dt.element_id, dt.threat_id))

        # Previous-conversation proposals
        for msg in ctx.deps.db.query(AIMessage).filter(
            AIMessage.conversation_id == ctx.deps.conversation_id
        ).all():
            for p in (msg.proposals or []):
                if p.get("type") == "threat" and p.get("status") in ("pending", "approved"):
                    existing_pairs.add((p.get("element_id"), p.get("threat_id")))

        registered: list[str] = []
        skipped = 0

        for item in items:
            if (item.element_id, item.threat_id) in existing_pairs:
                skipped += 1
                continue
            if any(
                p["type"] == "threat" and p["element_id"] == item.element_id and p["threat_id"] == item.threat_id
                for p in ctx.deps.proposals
            ):
                skipped += 1
                continue

            threat = threat_map.get(item.threat_id)
            proposal_id = f"prop_t_{uuid.uuid4().hex[:8]}"
            ctx.deps.proposals.append({
                "id": proposal_id,
                "type": "threat",
                "element_id": item.element_id,
                "element_type": item.element_type,
                "element_label": _get_element_label(ctx, item.element_id),
                "threat_id": item.threat_id,
                "name": threat.name if threat else f"Threat #{item.threat_id}",
                "description": threat.description if threat else "",
                "category": threat.category if threat else None,
                "model_id": ctx.deps.model_id,
                "pending_model_proposal_id": item.model_proposal_id or ctx.deps.pending_model_proposal_id,
                "reasoning": item.reasoning,
                "confidence": item.confidence if item.confidence in ("low", "medium", "high") else "medium",
                "likelihood": None,
                "impact": None,
                "risk_score": None,
                "severity": None,
                "status": "pending",
            })
            registered.append(proposal_id)
            existing_pairs.add((item.element_id, item.threat_id))

        await _emit(ctx, f"Registered {len(registered)} threat proposals ({skipped} skipped as duplicates)…")
        return f"Registered {len(registered)} threats, skipped {skipped} duplicates. IDs: {', '.join(registered)}"

    @agent.tool(retries=3)
    async def propose_mitigations_batch(ctx, items: list[_MitigationBatchItem]) -> str:
        """Propose multiple mitigations in ONE call — mandatory for efficiency.
        Use this instead of calling propose_mitigation in a loop.
        Pass ALL mitigation proposals for the entire diagram at once."""
        if not items:
            return "No mitigation items provided — nothing to propose."
        from app.models import DiagramMitigation, Mitigation
        from app.models.ai import AIMessage

        mit_ids = {item.mitigation_id for item in items}
        mit_map = {
            m.id: m for m in ctx.deps.db.query(Mitigation).filter(Mitigation.id.in_(mit_ids)).all()
        } if mit_ids else {}

        # Pre-load existing mitigations for deduplication
        existing_pairs: set[tuple] = set()
        for dm in ctx.deps.db.query(DiagramMitigation).filter(
            DiagramMitigation.diagram_id == ctx.deps.diagram_id
        ).all():
            existing_pairs.add((dm.element_id, dm.mitigation_id))

        for msg in ctx.deps.db.query(AIMessage).filter(
            AIMessage.conversation_id == ctx.deps.conversation_id
        ).all():
            for p in (msg.proposals or []):
                if p.get("type") == "mitigation" and p.get("status") in ("pending", "approved"):
                    existing_pairs.add((p.get("element_id"), p.get("mitigation_id")))

        registered: list[str] = []
        skipped = 0

        for item in items:
            if (item.element_id, item.mitigation_id) in existing_pairs:
                skipped += 1
                continue
            if any(
                p["type"] == "mitigation" and p["element_id"] == item.element_id and p["mitigation_id"] == item.mitigation_id
                for p in ctx.deps.proposals
            ):
                skipped += 1
                continue

            # Resolve linked threat KB id from in-memory proposals
            linked_threat_kb_id: int | None = None
            if item.for_threat_proposal_id:
                for p in ctx.deps.proposals:
                    if p.get("id") == item.for_threat_proposal_id and p.get("type") == "threat":
                        linked_threat_kb_id = p.get("threat_id")
                        break

            mit = mit_map.get(item.mitigation_id)
            proposal_id = f"prop_m_{uuid.uuid4().hex[:8]}"
            ctx.deps.proposals.append({
                "id": proposal_id,
                "type": "mitigation",
                "element_id": item.element_id,
                "element_type": item.element_type,
                "element_label": _get_element_label(ctx, item.element_id),
                "mitigation_id": item.mitigation_id,
                "name": mit.name if mit else f"Mitigation #{item.mitigation_id}",
                "description": mit.description if mit else "",
                "category": mit.category if mit else None,
                "model_id": ctx.deps.model_id,
                "pending_model_proposal_id": item.model_proposal_id or ctx.deps.pending_model_proposal_id,
                "reasoning": item.reasoning,
                "confidence": item.confidence if item.confidence in ("low", "medium", "high") else "medium",
                "for_threat_proposal_id": item.for_threat_proposal_id or None,
                "linked_threat_kb_id": linked_threat_kb_id,
                "status": "pending",
            })
            registered.append(proposal_id)
            existing_pairs.add((item.element_id, item.mitigation_id))

        await _emit(ctx, f"Registered {len(registered)} mitigation proposals ({skipped} skipped as duplicates)…")
        return f"Registered {len(registered)} mitigations, skipped {skipped} duplicates. IDs: {', '.join(registered)}"

    @agent.tool
    async def get_models_for_diagram(ctx) -> list[dict[str, Any]]:
        """Get all threat models for this diagram with their framework names.
        Call this BEFORE any analysis to verify you are saving to the correct model."""
        await _emit(ctx, "Checking available threat models for this diagram…")
        from app.models.model import Model as ModelTable
        from app.models import Framework

        models = ctx.deps.db.query(ModelTable).filter(
            ModelTable.diagram_id == ctx.deps.diagram_id
        ).all()

        result = []
        for m in models:
            fw = ctx.deps.db.query(Framework).filter(Framework.id == m.framework_id).first()
            result.append({
                "model_id": m.id,
                "model_name": m.name,
                "framework_id": m.framework_id,
                "framework_name": fw.name if fw else "Unknown",
                "is_active": m.id == ctx.deps.model_id,
            })
        return result

    @agent.tool
    async def switch_model_context(ctx, model_id: CoercedInt) -> dict[str, Any]:
        """Switch the active model context so subsequent proposals target a different model.
        Call this when the requested framework does not match the currently active model.
        Returns the new active model details or an error if the model is not found."""
        from app.models.model import Model as ModelTable

        model = ctx.deps.db.query(ModelTable).filter(
            ModelTable.id == model_id,
            ModelTable.diagram_id == ctx.deps.diagram_id,
        ).first()
        if not model:
            return {"error": f"Model {model_id} not found for this diagram"}

        ctx.deps.model_id = model_id
        ctx.deps.framework_id = model.framework_id
        ctx.deps.pending_model_proposal_id = None  # existing model — no pending create

        from app.models import Framework
        fw = ctx.deps.db.query(Framework).filter(Framework.id == model.framework_id).first()
        await _emit(ctx, f"Switched to model '{model.name}' ({fw.name if fw else 'Unknown framework'})…")
        return {
            "switched_to_model_id": model_id,
            "framework_id": model.framework_id,
            "framework_name": fw.name if fw else "Unknown",
            "model_name": model.name,
        }

    return agent
