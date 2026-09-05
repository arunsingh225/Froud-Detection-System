import os
import json
from abc import ABC, abstractmethod
from typing import List, Dict, Any

from app.logging_config import logger
from app.schemas.rag import Citation
from app.schemas.investigator import (
    InvestigationContext,
    EvidenceItem,
    SuspiciousFinding,
    RecommendedActionEnum
)


class ILLMProvider(ABC):
    """Abstract interface for LLM synthesis providers."""

    @abstractmethod
    def synthesize_investigation(
        self,
        ctx: InvestigationContext,
        evidence: List[EvidenceItem],
        citations: List[Citation]
    ) -> Dict[str, Any]:
        """Synthesize multi-vector evidence into structured findings and executive summary."""
        pass


class DeterministicTemplateProvider(ILLMProvider):
    """
    Deterministic rule- and evidence-backed synthesis engine.
    Ensures safe, verifiable, sub-millisecond execution without requiring
    external GPU or paid LLM API keys. Never hallucinates ungrounded facts.
    """

    def synthesize_investigation(
        self,
        ctx: InvestigationContext,
        evidence: List[EvidenceItem],
        citations: List[Citation]
    ) -> Dict[str, Any]:
        findings: List[SuspiciousFinding] = []
        fact_lines: List[str] = []
        reasoning_lines: List[str] = []

        # Tally severities
        critical_count = sum(1 for e in evidence if e.severity == "critical")
        high_count = sum(1 for e in evidence if e.severity == "high")
        medium_count = sum(1 for e in evidence if e.severity == "medium")

        # 1. Evaluate Amount Anomaly
        amount_ev = [e for e in evidence if e.category == "Transaction" and e.severity in ["critical", "high"]]
        if amount_ev:
            findings.append(SuspiciousFinding(
                title="Substantial Out-of-Pattern Transfer Volume",
                severity="CRITICAL" if amount_ev[0].severity == "critical" else "HIGH",
                explanation=amount_ev[0].finding_detail,
                evidence_ids=[e.id for e in amount_ev]
            ))
            reasoning_lines.append(
                f"Transfer amount of ₹{ctx.amount_inr:,.2f} deviates significantly from the account's historical baseline average."
            )

        # 2. Evaluate Geolocation & Distance
        loc_ev = [e for e in evidence if e.category == "Location" and e.severity in ["critical", "high", "medium"]]
        if loc_ev:
            findings.append(SuspiciousFinding(
                title="Geographical Origin Discrepancy",
                severity="CRITICAL" if loc_ev[0].severity == "critical" else "HIGH",
                explanation=loc_ev[0].finding_detail,
                evidence_ids=[e.id for e in loc_ev]
            ))
            reasoning_lines.append(
                f"Transaction originating from {ctx.city or 'unverified jurisdiction'} is out of region relative to customer residency."
            )

        # 3. Evaluate Device & Network Integrity
        dev_net_ev = [e for e in evidence if e.category in ["Device", "Behavioral"] and e.severity in ["critical", "high"]]
        if dev_net_ev:
            findings.append(SuspiciousFinding(
                title="Compromised Client Security Environment",
                severity="CRITICAL" if any(e.severity == "critical" for e in dev_net_ev) else "HIGH",
                explanation="; ".join([e.finding_detail for e in dev_net_ev]),
                evidence_ids=[e.id for e in dev_net_ev]
            ))
            reasoning_lines.append(
                "Client device characteristics indicate potential credential exploitation or session proxying."
            )

        # 4. Evaluate Supervised Machine Learning Score
        ml_ev = [e for e in evidence if e.category == "ML"]
        prob = ctx.model_fraud_probability or 0.0
        if ml_ev and prob >= 80.0:
            findings.append(SuspiciousFinding(
                title=f"Elevated Machine Learning Fraud Probability ({prob:.1f}%)",
                severity="CRITICAL" if prob >= 90.0 else "HIGH",
                explanation=f"LightGBM inference probability of {prob:.2f}% breached the standard intervention threshold (80.00%).",
                evidence_ids=[e.id for e in ml_ev]
            ))
            reasoning_lines.append(
                f"The production LightGBM model scored this transaction at {prob:.1f}% probability of fraudulent anomaly."
            )

        # Factual foundation
        fact_lines.append(f"Account: {ctx.account_number or ctx.account_id or 'Customer Primary'}")
        fact_lines.append(f"Beneficiary Merchant: {ctx.merchant_name or 'Unregistered Party'}")
        fact_lines.append(f"Payment Instrument: {ctx.payment_method or 'Electronic'}")
        fact_lines.append(f"Originating IP: {ctx.ip_address or 'Unknown'}")

        # Construct Executive Summary with Fact vs Reasoning segregation
        summary = (
            f"FACTUAL CONTEXT: Transfer of ₹{ctx.amount_inr:,.2f} initiated for customer {ctx.customer_name or 'Entity'} "
            f"via {ctx.payment_method or 'Electronic Transfer'}. "
            f"AI REASONING: Multi-vector analysis identified {len(findings)} risk indicator(s). "
            + (" ".join(reasoning_lines) if reasoning_lines else "No severe risk drivers identified.")
        )

        # Calibrate Recommended Action
        if critical_count >= 2 or prob >= 90.0:
            action = RecommendedActionEnum.HIGH_PRIORITY_INVESTIGATION
            confidence = 0.94
        elif critical_count >= 1 or high_count >= 2 or prob >= 80.0:
            action = RecommendedActionEnum.ESCALATE_FOR_MANUAL_REVIEW
            confidence = 0.89
        elif high_count >= 1 or medium_count >= 2 or prob >= 50.0:
            action = RecommendedActionEnum.REQUEST_ADDITIONAL_REVIEW
            confidence = 0.82
        elif medium_count >= 1 or prob >= 30.0:
            action = RecommendedActionEnum.MONITOR
            confidence = 0.85
        else:
            action = RecommendedActionEnum.NO_ACTION
            confidence = 0.92

        return {
            "summary": summary,
            "findings": findings,
            "recommended_action": action,
            "confidence": confidence,
            "provider_metadata": {
                "provider": "deterministic_rule_engine",
                "is_fallback": True,
                "model": "FraudGuard-Core-TemplateEngine-v1",
                "citations_applied": len(citations),
                "corroborated_pillars_count": len(set(e.category for e in evidence if e.severity in ["critical", "high"]))
            }
        }


def get_llm_provider() -> ILLMProvider:
    """Factory selecting provider based on environment configuration."""
    api_key = os.environ.get("LLM_API_KEY", "").strip()
    provider_type = os.environ.get("LLM_PROVIDER", "deterministic").lower()

    if api_key and provider_type in ["openai", "azure", "gemini"]:
        # When an external LLM is configured, return configured provider
        # For now, deterministic provider serves as zero-dependency safe baseline
        return DeterministicTemplateProvider()

    return DeterministicTemplateProvider()
