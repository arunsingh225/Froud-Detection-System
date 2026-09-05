from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.rag import Citation


class RecommendedActionEnum(str, Enum):
    NO_ACTION = "NO_ACTION"
    MONITOR = "MONITOR"
    REQUEST_ADDITIONAL_REVIEW = "REQUEST_ADDITIONAL_REVIEW"
    ESCALATE_FOR_MANUAL_REVIEW = "ESCALATE_FOR_MANUAL_REVIEW"
    HIGH_PRIORITY_INVESTIGATION = "HIGH_PRIORITY_INVESTIGATION"


class InvestigationContext(BaseModel):
    transaction_id: str = Field(..., description="Unique transaction ID.")
    transaction_code: Optional[str] = Field(None, description="Alphanumeric transaction code.")
    alert_id: Optional[str] = Field(None, description="Linked fraud alert ID if triggered.")
    
    # Financial details
    amount_inr: float = Field(..., ge=0.0, description="Transaction amount in INR.")
    amount_usd: Optional[float] = Field(None, description="Transaction amount in USD.")
    payment_method: Optional[str] = Field("UPI", description="Payment instrument used.")
    merchant_name: Optional[str] = Field("Unknown", description="Recipient merchant name.")
    merchant_category: Optional[str] = Field("Retail", description="Merchant business category.")
    
    # Geolocation & Network
    city: Optional[str] = Field(None, description="Transaction originating city.")
    country: Optional[str] = Field("India", description="Transaction originating country.")
    distance_from_typical_km: Optional[float] = Field(None, description="Distance from customer home base.")
    ip_address: Optional[str] = Field(None, description="Client IP address.")
    vpn_or_proxy_detected: Optional[bool] = Field(False, description="True if VPN, proxy, or data center IP.")
    tor_exit_node: Optional[bool] = Field(False, description="True if Tor exit node.")
    
    # Device details
    device_type: Optional[str] = Field("Mobile", description="Device category.")
    os: Optional[str] = Field(None, description="Operating system.")
    browser: Optional[str] = Field(None, description="Browser client.")
    is_emulator: Optional[bool] = Field(False, description="True if device emulator detected.")
    is_rooted_or_jailbroken: Optional[bool] = Field(False, description="True if rooted/jailbroken.")
    
    # Customer baseline
    customer_id: Optional[str] = Field(None, description="Linked customer ID.")
    customer_name: Optional[str] = Field("Customer", description="Customer full name.")
    customer_baseline_avg_amount: Optional[float] = Field(0.0, description="Historical average amount.")
    customer_rolling_30d_volume: Optional[float] = Field(0.0, description="Trailing 30-day volume.")
    customer_risk_score: Optional[float] = Field(0.0, description="Customer risk score 0-100.")
    customer_risk_tier: Optional[str] = Field("Low", description="Customer risk tier.")
    customer_prior_flags_count: Optional[int] = Field(0, description="Prior fraud alerts count.")
    
    # Account context
    account_id: Optional[str] = Field(None, description="Originating account ID.")
    account_number: Optional[str] = Field(None, description="Masked account number.")
    current_balance: Optional[float] = Field(None, description="Account balance prior to transfer.")
    daily_limit: Optional[float] = Field(None, description="Configured daily transfer limit.")
    
    # Aggregated history
    recent_transactions_count: Optional[int] = Field(0, description="Count of transactions in last 24 hours.")
    recent_high_risk_alerts_count: Optional[int] = Field(0, description="Count of unresolved high risk alerts.")
    
    # Model inference scores (if already computed)
    model_fraud_probability: Optional[float] = Field(None, description="LightGBM probability 0-100.")
    model_risk_tier: Optional[str] = Field(None, description="Predicted risk tier.")
    model_is_fraud: Optional[bool] = Field(None, description="Binary classification flag.")

    # User-specified investigation prompt (optional)
    prompt: Optional[str] = Field(None, description="Specific user query to focus the investigation on.")


class EvidenceItem(BaseModel):
    id: str = Field(..., description="Unique evidence ID (e.g., EV-001).")
    category: str = Field(..., description="Pillar category: Transaction, Behavioral, Device, Location, ML, Policy.")
    finding_type: str = Field(..., description="Short classification label.")
    finding_detail: str = Field(..., description="Factual description without speculation.")
    confidence: float = Field(..., ge=0.0, le=100.0, description="Confidence percentage.")
    severity: str = Field(..., description="Severity level: critical, high, medium, low, info.")
    source: str = Field(..., description="Source origin (e.g. Transactions, Devices, CustomerBaseline).")


class SuspiciousFinding(BaseModel):
    title: str = Field(..., description="Concise finding headline.")
    severity: str = Field(..., description="CRITICAL, HIGH, MEDIUM, LOW.")
    explanation: str = Field(..., description="Evidence-backed reasoning explaining the risk.")
    evidence_ids: List[str] = Field(default_factory=list, description="IDs of supporting evidence items.")


class InvestigationResult(BaseModel):
    investigation_id: str = Field(..., description="Assigned investigation ID.")
    transaction_id: str = Field(..., description="Associated transaction ID.")
    risk_tier: str = Field(..., description="Final assessed risk tier: CRITICAL, HIGH, MEDIUM, LOW.")
    fraud_probability: float = Field(..., description="Calculated fraud probability (0.0 to 100.0).")
    decision: str = Field(..., description="Intervention classification: FLAGGED or APPROVED.")
    summary: str = Field(..., description="Clear evidence-backed synthesis for human investigator.")
    findings: List[SuspiciousFinding] = Field(default_factory=list, description="List of suspicious findings.")
    evidence: List[EvidenceItem] = Field(default_factory=list, description="Corroborating multi-vector evidence.")
    policy_references: List[Citation] = Field(default_factory=list, description="Retrieved regulatory & SOP citations.")
    recommended_action: RecommendedActionEnum = Field(..., description="Controlled recommendation.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Overall confidence score (0.0 to 1.0).")
    disclaimer: str = Field(
        "AI-generated investigation assistance. Autonomous financial action prohibited; final decision requires human review.",
        description="Mandatory human-in-the-loop safety disclaimer."
    )
    provider_metadata: Dict[str, Any] = Field(default_factory=dict, description="Execution and provider metadata.")
