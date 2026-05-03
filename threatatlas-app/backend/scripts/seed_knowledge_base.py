#!/usr/bin/env python3
"""Script to seed the database with knowledge base data (STRIDE, PASTA, OWASP LLM Top 10)."""

import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Framework, Threat, Mitigation
from app.seed_data import (
    FRAMEWORKS,
    STRIDE_THREATS,
    STRIDE_MITIGATIONS,
    PASTA_THREATS,
    PASTA_MITIGATIONS,
    OWASP_LLM_THREATS,
    OWASP_LLM_MITIGATIONS,
)


def _seed_framework(db: Session, name: str, description: str, threats: list, mitigations: list) -> None:
    existing = db.query(Framework).filter(Framework.name == name).first()
    if existing:
        print(f"  · {name} already exists — skipping")
        return

    framework = Framework(name=name, description=description, is_custom=False)
    db.add(framework)
    db.commit()
    db.refresh(framework)

    for t in threats:
        db.add(Threat(framework_id=framework.id, is_custom=False, **t))
    db.commit()

    for m in mitigations:
        db.add(Mitigation(framework_id=framework.id, is_custom=False, **m))
    db.commit()

    print(f"  ✓ {name}: {len(threats)} threats, {len(mitigations)} mitigations")


def seed_database():
    """Seed the database with frameworks, threats, and mitigations."""
    db: Session = SessionLocal()
    try:
        print("Seeding knowledge base...")

        _seed_framework(
            db,
            name=FRAMEWORKS[0]["name"],
            description=FRAMEWORKS[0]["description"],
            threats=STRIDE_THREATS,
            mitigations=STRIDE_MITIGATIONS,
        )

        _seed_framework(
            db,
            name=FRAMEWORKS[1]["name"],
            description=FRAMEWORKS[1]["description"],
            threats=PASTA_THREATS,
            mitigations=PASTA_MITIGATIONS,
        )

        _seed_framework(
            db,
            name="OWASP LLM Top 10",
            description=(
                "The OWASP Top 10 for Large Language Model Applications (2025 edition) identifies "
                "the most critical security risks specific to LLM-powered systems—from prompt injection "
                "and sensitive data exposure to supply chain weaknesses and unbounded resource consumption. "
                "See https://genai.owasp.org/llm-top-10/ for the full specification."
            ),
            threats=OWASP_LLM_THREATS,
            mitigations=OWASP_LLM_MITIGATIONS,
        )

        print("\n✓ Knowledge base seeded successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
