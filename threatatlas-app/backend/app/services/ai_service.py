"""AI service — orchestrates pydantic-ai agent, conversation history, and proposal handling."""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import AsyncGenerator, Any

from sqlalchemy.orm import Session

from app.models.ai import AIConfig, AIConversation, AIMessage

logger = logging.getLogger(__name__)

_RETRY_AFTER_SECONDS_RE = re.compile(r"try again in\s+([0-9]*\.?[0-9]+)s", re.IGNORECASE)


def _extract_retry_after_seconds(exc: Exception) -> float:
    """
    Best-effort parse of retry delay from OpenAI/Pydantic error payloads.
    Falls back to a short safe delay if not present.
    """
    text = str(exc)
    match = _RETRY_AFTER_SECONDS_RE.search(text)
    if match:
        try:
            # Add a small buffer to reduce immediate re-limit.
            return max(0.5, float(match.group(1)) + 0.4)
        except ValueError:
            pass
    return 2.0


def _is_rate_limit_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return ("429" in text) or ("rate limit" in text) or ("rate_limit_exceeded" in text)


def get_active_config(db: Session) -> AIConfig | None:
    return db.query(AIConfig).filter(AIConfig.is_active == True).first()


def _build_message_history(messages: list[AIMessage]) -> list[Any]:
    """Reconstruct pydantic-ai message history from stored DB messages."""
    try:
        from pydantic_ai.messages import (
            ModelRequest,
            ModelResponse,
            UserPromptPart,
            TextPart,
        )
        history = []
        for msg in messages:
            if msg.role == "user":
                history.append(ModelRequest(parts=[UserPromptPart(content=msg.content)]))
            elif msg.role == "assistant":
                history.append(ModelResponse(parts=[TextPart(content=msg.content)]))
        return history
    except Exception:
        # Fallback: return empty history if pydantic-ai message types changed
        return []


async def stream_chat(
    db: Session,
    conversation: AIConversation,
    user_message: str,
    active_model_id: int | None,
    framework_id: int | None,
) -> AsyncGenerator[str, None]:
    """
    Stream AI response as SSE events.

    Yields strings in the format:
      data: {"delta": "text chunk"}\n\n
      data: {"done": true, "message": {...}}\n\n
      data: {"error": "message"}\n\n
    """
    config = get_active_config(db)
    if not config:
        yield f'data: {json.dumps({"error": "AI is not configured. Ask an admin to set up the AI provider in Settings."})}\n\n'
        return

    try:
        from app.ai.agent import build_agent, AgentDeps
    except RuntimeError:
        logger.exception("stream_chat: AI agent failed to load")
        yield f'data: {json.dumps({"error": "AI runtime is not available. Ask an admin to check server configuration."})}\n\n'
        return

    # Save the user message first
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Auto-title the conversation from first user message
    if not conversation.title:
        conversation.title = user_message[:80]
        db.commit()

    # Load history (exclude the message we just saved)
    history_msgs = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conversation.id, AIMessage.id < user_msg.id)
        .order_by(AIMessage.id)
        .all()
    )
    history = _build_message_history(history_msgs)

    deps = AgentDeps(
        db=db,
        diagram_id=conversation.diagram_id,
        conversation_id=conversation.id,
        model_id=active_model_id,
        framework_id=framework_id,
    )

    agent = build_agent(config)
    all_chunks: list[str] = []

    max_attempts = 3
    last_exc: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        all_chunks.clear()
        try:
            from pydantic_ai.usage import UsageLimits
            async with agent.run_stream(
                user_message,
                message_history=history,
                deps=deps,
                usage_limits=UsageLimits(request_limit=300),
            ) as result:
                async for chunk in result.stream_text(delta=True):
                    all_chunks.append(chunk)
                    yield f'data: {json.dumps({"delta": chunk})}\n\n'

            full_text = "".join(all_chunks)
            proposals = deps.proposals

            # Extract token usage from pydantic-ai result
            input_tokens: int | None = None
            output_tokens: int | None = None
            try:
                usage = result.usage()
                input_tokens = usage.request_tokens
                output_tokens = usage.response_tokens
            except Exception as e:
                logger.debug("Token usage unavailable from agent result: %s", e)

            # Persist assistant message + proposals
            assistant_msg = AIMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=full_text,
                proposals=proposals if proposals else None,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                token_count=(input_tokens or 0) + (output_tokens or 0) or None,
                ai_model_name=config.model_name,
                ai_provider=config.provider,
            )
            db.add(assistant_msg)
            db.commit()
            db.refresh(assistant_msg)

            yield f'data: {json.dumps({"done": True, "message": {"id": assistant_msg.id, "role": "assistant", "content": full_text, "proposals": proposals, "created_at": assistant_msg.created_at.isoformat()}})}\n\n'
            return

        except Exception as exc:
            last_exc = exc
            # Retry only on rate-limit errors and only if no partial chunks were emitted.
            # If chunks were already streamed, retrying would duplicate/garble output.
            if _is_rate_limit_error(exc) and not all_chunks and attempt < max_attempts:
                wait_seconds = _extract_retry_after_seconds(exc)
                logger.warning(
                    "AI rate-limited (attempt %s/%s), retrying in %.2fs",
                    attempt, max_attempts, wait_seconds
                )
                await asyncio.sleep(wait_seconds)
                continue
            break

    if last_exc:
        logger.error("AI stream error: %s", last_exc, exc_info=last_exc)
    else:
        logger.error("AI stream error: unknown error")
    if last_exc and _is_rate_limit_error(last_exc):
        yield f'data: {json.dumps({"error": "AI provider is temporarily rate-limited. Please retry in a few seconds."})}\n\n'
    else:
        yield f'data: {json.dumps({"error": "AI request failed. Please try again later."})}\n\n'


def approve_proposal(
    db: Session,
    message: AIMessage,
    proposal_id: str,
    diagram_id: int,
    user_id: int,
) -> dict[str, Any]:
    """Create a DiagramThreat or DiagramMitigation from an approved proposal."""
    proposals: list[dict] = message.proposals or []
    proposal = next((p for p in proposals if p["id"] == proposal_id), None)
    if not proposal:
        raise ValueError(f"Proposal {proposal_id} not found in message {message.id}")
    if proposal.get("status") != "pending":
        raise ValueError(f"Proposal {proposal_id} is already {proposal['status']}")

    from app.models import Diagram, DiagramThreat, DiagramMitigation

    # Verify diagram access
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise ValueError("Diagram not found")

    result: dict[str, Any] = {}
    proposal_type = proposal["type"]

    if proposal_type == "create_model":
        from app.models import Framework
        from app.models.model import Model as ModelTable, ModelStatus

        framework_id = proposal["framework_id"]

        # Reuse an existing model if one was already created (e.g. by a parallel approval)
        existing_model = db.query(ModelTable).filter(
            ModelTable.diagram_id == diagram_id,
            ModelTable.framework_id == framework_id,
        ).first()

        if existing_model:
            new_model = existing_model
        else:
            new_model = ModelTable(
                diagram_id=diagram_id,
                framework_id=framework_id,
                name=proposal["name"],
                status=ModelStatus.in_progress,
                created_by=user_id,
            )
            db.add(new_model)
            db.flush()

        framework = db.query(Framework).filter(Framework.id == framework_id).first()

        # Patch all sibling proposals in this message that have model_id=None
        patched: list[dict] = []
        for p in proposals:
            if p["id"] == proposal_id:
                patched.append({**p, "status": "approved"})
            elif p.get("model_id") is None and p.get("type") in ("threat", "mitigation"):
                patched.append({**p, "model_id": new_model.id})
            else:
                patched.append(p)
        message.proposals = patched
        db.commit()

        return {
            "type": "create_model",
            "id": new_model.id,
            "framework_id": framework_id,
            "framework_name": framework.name if framework else "Unknown",
            "name": new_model.name,
        }

    if proposal_type == "update_risk":
        dt = db.query(DiagramThreat).filter(
            DiagramThreat.id == proposal["diagram_threat_id"],
            DiagramThreat.diagram_id == diagram_id,
        ).first()
        if not dt:
            raise HTTPException(status_code=404, detail="DiagramThreat not found")
        dt.likelihood = proposal["likelihood"]
        dt.impact = proposal["impact"]
        dt.risk_score = proposal["risk_score"]
        dt.severity = proposal["severity"]
        db.flush()
        result = {
            "type": "update_risk",
            "id": dt.id,
            "likelihood": dt.likelihood,
            "impact": dt.impact,
            "risk_score": dt.risk_score,
            "severity": dt.severity,
        }

    elif proposal_type == "remove_threat":
        row = db.query(DiagramThreat).filter(
            DiagramThreat.id == proposal["diagram_item_id"],
            DiagramThreat.diagram_id == diagram_id,
        ).first()
        if row:
            db.delete(row)
            db.flush()
        result = {"type": "remove_threat", "diagram_item_id": proposal["diagram_item_id"]}

    elif proposal_type == "remove_mitigation":
        row = db.query(DiagramMitigation).filter(
            DiagramMitigation.id == proposal["diagram_item_id"],
            DiagramMitigation.diagram_id == diagram_id,
        ).first()
        if row:
            db.delete(row)
            db.flush()
        result = {"type": "remove_mitigation", "diagram_item_id": proposal["diagram_item_id"]}

    elif proposal_type == "suggest_kb_threat":
        from app.models import Threat
        # Create new KB threat entry
        new_threat = Threat(
            framework_id=proposal.get("framework_id"),
            name=proposal["name"],
            description=proposal.get("description", ""),
            category=proposal.get("category"),
            is_custom=True,
        )
        db.add(new_threat)
        db.flush()
        # Apply to this element
        dt = DiagramThreat(
            diagram_id=diagram_id,
            model_id=proposal.get("model_id"),
            threat_id=new_threat.id,
            element_id=proposal["element_id"],
            element_type=proposal.get("element_type", "node"),
            status="identified",
            likelihood=proposal.get("likelihood"),
            impact=proposal.get("impact"),
            risk_score=proposal.get("risk_score"),
            severity=proposal.get("severity"),
        )
        db.add(dt)
        db.flush()
        result = {
            "type": "suggest_kb_threat",
            "id": dt.id,
            "threat_id": new_threat.id,
            "kb_created": True,
            "element_id": proposal["element_id"],
        }

    elif proposal_type == "suggest_kb_mitigation":
        from app.models import Mitigation
        # Create new KB mitigation entry
        new_mit = Mitigation(
            framework_id=proposal.get("framework_id"),
            name=proposal["name"],
            description=proposal.get("description", ""),
            category=proposal.get("category"),
            is_custom=True,
        )
        db.add(new_mit)
        db.flush()
        # Link to parent threat if available
        diagram_threat_id_custom: int | None = None
        linked_kb_threat_custom = proposal.get("linked_threat_kb_id")
        if linked_kb_threat_custom and proposal.get("element_id"):
            parent_dt = db.query(DiagramThreat).filter(
                DiagramThreat.diagram_id == diagram_id,
                DiagramThreat.element_id == proposal["element_id"],
                DiagramThreat.threat_id == linked_kb_threat_custom,
            ).first()
            if parent_dt:
                diagram_threat_id_custom = parent_dt.id
        dm = DiagramMitigation(
            diagram_id=diagram_id,
            model_id=proposal.get("model_id"),
            mitigation_id=new_mit.id,
            element_id=proposal["element_id"],
            element_type=proposal.get("element_type", "node"),
            threat_id=diagram_threat_id_custom,
            status="proposed",
        )
        db.add(dm)
        db.flush()
        result = {
            "type": "suggest_kb_mitigation",
            "id": dm.id,
            "mitigation_id": new_mit.id,
            "kb_created": True,
            "element_id": proposal["element_id"],
        }

    elif proposal_type == "threat":
        dt = DiagramThreat(
            diagram_id=diagram_id,
            model_id=proposal.get("model_id"),
            threat_id=proposal["threat_id"],
            element_id=proposal["element_id"],
            element_type=proposal.get("element_type", "node"),
            status="identified",
            likelihood=proposal.get("likelihood"),
            impact=proposal.get("impact"),
            risk_score=proposal.get("risk_score"),
            severity=proposal.get("severity"),
        )
        db.add(dt)
        db.flush()
        result = {"type": "threat", "id": dt.id, "threat_id": proposal["threat_id"], "element_id": proposal["element_id"]}

    else:  # mitigation
        # Try to find the DiagramThreat this mitigation addresses so we can bind them
        diagram_threat_id: int | None = None
        linked_kb_threat = proposal.get("linked_threat_kb_id")
        if linked_kb_threat and proposal.get("element_id"):
            parent_dt = db.query(DiagramThreat).filter(
                DiagramThreat.diagram_id == diagram_id,
                DiagramThreat.element_id == proposal["element_id"],
                DiagramThreat.threat_id == linked_kb_threat,
            ).first()
            if parent_dt:
                diagram_threat_id = parent_dt.id

        dm = DiagramMitigation(
            diagram_id=diagram_id,
            model_id=proposal.get("model_id"),
            mitigation_id=proposal["mitigation_id"],
            element_id=proposal["element_id"],
            element_type=proposal.get("element_type", "node"),
            threat_id=diagram_threat_id,
            status="proposed",
        )
        db.add(dm)
        db.flush()
        result = {"type": "mitigation", "id": dm.id, "mitigation_id": proposal["mitigation_id"], "element_id": proposal["element_id"]}

    # Update proposal status in-place
    updated_proposals = [
        {**p, "status": "approved"} if p["id"] == proposal_id else p
        for p in proposals
    ]
    message.proposals = updated_proposals
    db.commit()

    return result


def dismiss_proposal(db: Session, message: AIMessage, proposal_id: str) -> None:
    proposals: list[dict] = message.proposals or []
    proposal = next((p for p in proposals if p["id"] == proposal_id), None)
    if not proposal:
        raise ValueError(f"Proposal {proposal_id} not found")
    updated = [
        {**p, "status": "dismissed"} if p["id"] == proposal_id else p
        for p in proposals
    ]
    message.proposals = updated
    db.commit()


def approve_all_proposals(
    db: Session,
    conversation_id: int,
    diagram_id: int,
    user_id: int,
) -> dict[str, Any]:
    """Approve every pending proposal across all messages in a conversation."""
    messages = db.query(AIMessage).filter(
        AIMessage.conversation_id == conversation_id
    ).all()

    created_threats = 0
    created_mitigations = 0
    created_models: list[dict] = []
    errors: list[str] = []

    for message in messages:
        if not message.proposals:
            continue
        pending = [p for p in message.proposals if p.get("status") == "pending"]
        # Process create_model proposals first so siblings get their model_id patched
        pending.sort(key=lambda p: 0 if p.get("type") == "create_model" else 1)
        for proposal in pending:
            try:
                result = approve_proposal(db, message, proposal["id"], diagram_id, user_id)
                t = result.get("type")
                if t in ("threat", "suggest_kb_threat"):
                    created_threats += 1
                elif t in ("mitigation", "suggest_kb_mitigation"):
                    created_mitigations += 1
                elif t == "create_model":
                    created_models.append(result)
            except ValueError as exc:
                logger.warning(
                    "approve_all_proposals: validation failed for proposal %s",
                    proposal["id"],
                    exc_info=True,
                )
                errors.append(f"{proposal['id']}: invalid proposal data")
            except Exception:
                logger.exception("approve_all_proposals: failed for proposal %s", proposal["id"])
                errors.append(f"{proposal['id']}: approval failed")

    db.commit()
    return {
        "created_threats": created_threats,
        "created_mitigations": created_mitigations,
        "created_models": created_models,
        "errors": errors,
    }


async def classify_diagram_elements(
    db: Session,
    elements: list[dict[str, str]],
) -> list[dict[str, str]]:
    """
    Use the active AI model to classify diagram elements into DFD types.

    Each element must have: id, label, style.
    Returns [{id, suggested_type, reasoning}].
    """
    from app.ai.encryption import decrypt_api_key

    config = get_active_config(db)
    if not config:
        raise ValueError("AI is not configured.")

    api_key = decrypt_api_key(config.api_key_encrypted)

    prompt = (
        "You are a Data Flow Diagram (DFD) expert.\n"
        "Classify each element below into exactly one of these DFD types:\n"
        "  - process    : service, API, application, function, AI/ML model, microservice, component\n"
        "  - datastore  : database, cache, file store, queue, storage, log, bucket\n"
        "  - external   : user, admin, browser, client, external system, third-party service\n"
        "  - boundary   : trust zone, security boundary, network zone, DMZ, VPC, subnet, region\n\n"
        "Each element includes `style`: the raw draw.io / mxGraph style string. Use it with the label:\n"
        "  - swimlane, dashed trust-zone / container, empty-group boundaries → boundary when they wrap or scope an area\n"
        "  - cylinder, database/cylinder3, stored data shapes → datastore when style matches\n"
        "  - ellipse, BPMN task, many cloud compute icons in style → process when the shape indicates compute\n"
        "  - If style and label disagree, prefer a clear draw.io shape in `style` so the on-canvas look matches the type.\n\n"
        "Respond ONLY with a valid JSON array — no markdown, no code fences, no extra text.\n"
        'Format (two fields only, no other keys): [{"id": "EXACT_ID", "type": "process"}]\n\n'
        "Elements to classify:\n"
        + json.dumps(
            [{"id": e["id"], "label": e["label"], "style": e.get("style") or ""} for e in elements],
            ensure_ascii=False,
        )
    )

    response_text: str = ""

    try:
        if config.provider == "anthropic":
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=api_key)
            message = await client.messages.create(
                model=config.model_name,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            response_text = message.content[0].text if message.content else ""
        else:
            from openai import AsyncOpenAI
            init_kwargs: dict[str, Any] = {"api_key": api_key}
            if config.base_url:
                init_kwargs["base_url"] = config.base_url
            client = AsyncOpenAI(**init_kwargs)
            completion = await client.chat.completions.create(
                model=config.model_name,
                messages=[{"role": "user", "content": prompt}],
                max_completion_tokens=2048,
            )
            response_text = (completion.choices[0].message.content or "") if completion.choices else ""
    except Exception:
        logger.exception("AI API call failed during element classification")
        raise

    logger.debug("classify_diagram_elements raw response: %.400s", response_text)

    # Strip optional markdown code fences and locate the JSON array
    clean = re.sub(r"```(?:json)?\s*", "", response_text).strip().rstrip("`").strip()
    arr_match = re.search(r"\[.*\]", clean, re.DOTALL)
    if arr_match:
        clean = arr_match.group(0)

    valid_types = {"process", "datastore", "external", "boundary"}

    try:
        parsed: list[dict[str, str]] = json.loads(clean)
        return [
            {
                "id": item.get("id", ""),
                "suggested_type": t if t in valid_types else "process",
                "reasoning": "",
            }
            for item in parsed
            for t in [item.get("type", item.get("suggested_type", "process"))]
        ]
    except json.JSONDecodeError:
        # Fallback: extract id + type pairs via regex
        logger.warning("JSON parse failed — using regex fallback: %.200s", clean)
        result = []
        for id_m, type_m in re.findall(
            r'"id"\s*:\s*"([^"]+)"[^}]{0,200}?"type"\s*:\s*"([^"]+)"',
            clean,
        ):
            result.append({
                "id": id_m,
                "suggested_type": type_m if type_m in valid_types else "process",
                "reasoning": "",
            })
        if result:
            return result
        logger.error("All extraction methods failed; returning heuristic passthrough")
        return [{"id": e.get("id", ""), "suggested_type": "process", "reasoning": ""} for e in elements]
