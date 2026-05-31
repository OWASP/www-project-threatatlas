import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models import Diagram as DiagramModel, User as UserModel
from app.models.ai import AIConversation, AIMessage
from app.schemas.ai import (
    ConversationCreate,
    ConversationResponse,
    ConversationWithMessages,
    MessageResponse,
    ProposalActionRequest,
)
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin, can_edit_product, PermissionDenied

router = APIRouter(prefix="/ai-conversations", tags=["ai-conversations"])


# Canonical instruction for a one-click, whole-diagram STRIDE analysis. The agent
# already exposes propose_threat / propose_mitigation tools, so a directive prompt
# makes it walk every element and emit reviewable draft proposals.
DIAGRAM_ANALYSIS_PROMPT = (
    "Perform a comprehensive threat model of this entire diagram. "
    "For every element (process, data store, external entity, data flow, and trust "
    "boundary), systematically work through the STRIDE categories (Spoofing, "
    "Tampering, Repudiation, Information disclosure, Denial of service, Elevation "
    "of privilege) and identify the threats that genuinely apply. For each threat "
    "you find, call propose_threat, and where a control is warranted call "
    "propose_mitigation linked to that threat. Prefer knowledge-base entries when "
    "they fit. Do not invent elements that are not in the diagram. Finish with a "
    "short summary of the most important risks."
)


class AnalyzeDiagramRequest(BaseModel):
    diagram_id: int


class AnalyzeDiagramResponse(BaseModel):
    conversation_id: int
    diagram_id: int
    prompt: str


def _assert_owner(conversation: AIConversation, user: UserModel) -> None:
    from app.models.enums import UserRole
    if conversation.user_id != user.id and user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")


# ── Conversations ──────────────────────────────────────────────────────────

@router.get("/", response_model=list[ConversationResponse])
def list_conversations(
    diagram_id: int | None = Query(None),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's conversations, optionally filtered by diagram."""
    q = db.query(AIConversation).filter(AIConversation.user_id == current_user.id)
    if diagram_id:
        q = q.filter(AIConversation.diagram_id == diagram_id)
    return q.order_by(AIConversation.updated_at.desc()).all()


@router.post("/", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    body: ConversationCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_standard_or_admin(current_user)
    diagram = db.query(DiagramModel).filter(DiagramModel.id == body.diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")

    conv = AIConversation(
        diagram_id=body.diagram_id,
        user_id=current_user.id,
        title=body.title,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.post("/analyze-diagram", response_model=AnalyzeDiagramResponse, status_code=status.HTTP_201_CREATED)
def analyze_diagram(
    body: AnalyzeDiagramRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One-click "analyze this diagram with AI".

    Validates that the caller may edit the diagram and that an AI provider is
    configured, then creates a conversation seeded for a full STRIDE analysis.
    The client drives generation by POSTing the returned ``prompt`` to the
    streaming ``messages`` endpoint, reusing the existing proposal/accept flow —
    so threats are surfaced as draft suggestions the user approves or dismisses.
    """
    require_standard_or_admin(current_user)

    from sqlalchemy.orm import joinedload
    diagram = (
        db.query(DiagramModel)
        .options(joinedload(DiagramModel.product))
        .filter(DiagramModel.id == body.diagram_id)
        .first()
    )
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    if not can_edit_product(current_user, diagram.product):
        raise PermissionDenied("Not authorized to analyze this diagram")

    from app.services.ai_service import get_active_config
    if get_active_config(db) is None:
        raise HTTPException(
            status_code=400,
            detail="AI is not configured. Ask an admin to set up the AI provider in Settings.",
        )

    conv = AIConversation(
        diagram_id=body.diagram_id,
        user_id=current_user.id,
        title="AI Threat Analysis",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return AnalyzeDiagramResponse(
        conversation_id=conv.id,
        diagram_id=body.diagram_id,
        prompt=DIAGRAM_ANALYSIS_PROMPT,
    )


@router.get("/{conversation_id}", response_model=ConversationWithMessages)
def get_conversation(
    conversation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user)
    return conv


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user)
    db.delete(conv)
    db.commit()


# ── Messages / Chat ────────────────────────────────────────────────────────

@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
def get_messages(
    conversation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user)
    return db.query(AIMessage).filter(AIMessage.conversation_id == conversation_id).order_by(AIMessage.id).all()


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: int,
    body: dict,
    active_model_id: int | None = Query(None),
    framework_id: int | None = Query(None),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a user message and stream the AI response as Server-Sent Events.

    Client must read the response as a stream. Each event has the format:
      data: {"delta": "text"}\n\n
      data: {"done": true, "message": {...}}\n\n
      data: {"error": "message"}\n\n
    """
    require_standard_or_admin(current_user)
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user)

    user_message = body.get("content", "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message content is required")

    from app.services.ai_service import stream_chat

    async def generator() -> AsyncGenerator[str, None]:
        try:
            async for event in stream_chat(
                db=db,
                conversation=conv,
                user_message=user_message,
                active_model_id=active_model_id,
                framework_id=framework_id,
            ):
                yield event
        except Exception:
            logger.exception("send_message: stream failed")
            yield f'data: {json.dumps({"error": "Request failed. Please try again later."})}\n\n'

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Proposal Actions ───────────────────────────────────────────────────────

@router.post("/{conversation_id}/messages/{message_id}/approve-proposal")
def approve_proposal(
    conversation_id: int,
    message_id: int,
    body: ProposalActionRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve a proposal — creates a DiagramThreat or DiagramMitigation."""
    require_standard_or_admin(current_user)
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user)

    message = db.query(AIMessage).filter(AIMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    from app.services.ai_service import approve_proposal as svc_approve
    try:
        result = svc_approve(
            db=db,
            message=message,
            proposal_id=body.proposal_id,
            diagram_id=conv.diagram_id,
            user_id=current_user.id,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{conversation_id}/messages/{message_id}/dismiss-proposal")
def dismiss_proposal(
    conversation_id: int,
    message_id: int,
    body: ProposalActionRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dismiss a proposal without adding it to the diagram."""
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user)

    message = db.query(AIMessage).filter(AIMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    from app.services.ai_service import dismiss_proposal as svc_dismiss
    try:
        svc_dismiss(db=db, message=message, proposal_id=body.proposal_id)
        return {"status": "dismissed"}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{conversation_id}/approve-all")
def approve_all_proposals(
    conversation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve every pending proposal in the conversation — creates all DiagramThreats and DiagramMitigations at once."""
    require_standard_or_admin(current_user)
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _assert_owner(conv, current_user)

    from app.services.ai_service import approve_all_proposals as svc_approve_all
    result = svc_approve_all(
        db=db,
        conversation_id=conversation_id,
        diagram_id=conv.diagram_id,
        user_id=current_user.id,
    )
    return result


# ── AI-assisted DrawIO element classification ──────────────────────────────

class DiagramElementInput(BaseModel):
    id: str
    label: str
    style: str = ""


class ClassifyElementsRequest(BaseModel):
    elements: list[DiagramElementInput]


@router.post("/classify-elements")
async def classify_elements(
    body: ClassifyElementsRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Use the active AI model to classify DrawIO elements into DFD types
    (process / datastore / external / boundary).

    Called during DrawIO import when the user enables AI Assist.
    Returns [{id, suggested_type, reasoning}] for each element.
    """
    require_standard_or_admin(current_user)

    if not body.elements:
        return []

    from app.services.ai_service import classify_diagram_elements
    try:
        results = await classify_diagram_elements(
            db=db,
            elements=[{"id": e.id, "label": e.label, "style": e.style} for e in body.elements],
        )
        return results
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("classify_elements endpoint error")
        raise HTTPException(
            status_code=500,
            detail="AI classification failed. Please try again later.",
        ) from exc
