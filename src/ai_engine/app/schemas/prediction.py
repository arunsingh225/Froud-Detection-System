from typing import Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict


class PredictionRequest(BaseModel):
    """
    Incoming transaction payload for real-time fraud assessment.
    Core transactional attributes are strongly recommended; all remaining 
    IEEE-CIS raw signals are optional and default safely to null/unseen codes.
    """
    model_config = ConfigDict(extra="allow")

    # Core Transaction Attributes
    TransactionAmt: float = Field(..., gt=0, description="Transaction monetary amount in USD", examples=[250.50])
    ProductCD: Optional[str] = Field("W", description="Product category code ('W', 'C', 'R', 'H', 'S')", examples=["W"])
    TransactionDT: Optional[int] = Field(86400, description="Elapsed seconds delta from reference epoch", examples=[86400])

    # Card Program & Payment Instrument Details
    card1: Optional[int] = Field(None, description="Payment card issuing institution / program code", examples=[12345])
    card2: Optional[float] = Field(None, description="Card program sub-tier", examples=[111.0])
    card3: Optional[float] = Field(None, description="Card issuing country / program identifier", examples=[150.0])
    card4: Optional[str] = Field(None, description="Card payment network brand ('visa', 'mastercard', etc.)", examples=["visa"])
    card5: Optional[float] = Field(None, description="Card sub-classification identifier", examples=[226.0])
    card6: Optional[str] = Field(None, description="Card funding category ('debit', 'credit')", examples=["credit"])

    # Billing & Shipping Address Metadata
    addr1: Optional[float] = Field(None, description="Billing zip / region code", examples=[123.0])
    addr2: Optional[float] = Field(None, description="Billing country code", examples=[87.0])
    dist1: Optional[float] = Field(None, description="Distance measure 1 (e.g., zip to IP)", examples=[15.0])
    dist2: Optional[float] = Field(None, description="Distance measure 2", examples=[None])

    # Digital Identity & Contact Metadata
    P_emaildomain: Optional[str] = Field(None, description="Purchaser contact email domain", examples=["gmail.com"])
    R_emaildomain: Optional[str] = Field(None, description="Recipient contact email domain", examples=["gmail.com"])

    # Device & Hardware Telemetry (Identity Group)
    DeviceInfo: Optional[str] = Field(None, description="User device model / OS signature", examples=["iOS Device"])
    DeviceType: Optional[str] = Field(None, description="Device classification ('mobile', 'desktop')", examples=["mobile"])
    id_30: Optional[str] = Field(None, description="Operating system release identifier", examples=["iOS 14.2"])
    id_31: Optional[str] = Field(None, description="Web browser and client version signature", examples=["safari"])
    id_01: Optional[float] = Field(None, description="Identity numeric challenge signal", examples=[-5.0])

    # Velocity and Accumulator Counters (Selected High-Impact C and D Features)
    C1: Optional[float] = Field(None, description="Card velocity accumulator 1")
    C2: Optional[float] = Field(None, description="Card velocity accumulator 2")
    C13: Optional[float] = Field(None, description="Cumulative transaction frequency counter", examples=[2.0])
    C14: Optional[float] = Field(None, description="Cumulative transaction counter 14")
    D1: Optional[float] = Field(None, description="Timed timedelta counter 1")
    D2: Optional[float] = Field(None, description="Timed timedelta counter 2")
    D4: Optional[float] = Field(None, description="Timed timedelta counter 4")
    D10: Optional[float] = Field(None, description="Timed timedelta counter 10")
    D15: Optional[float] = Field(None, description="Timed activity interval 15", examples=[20.0])
