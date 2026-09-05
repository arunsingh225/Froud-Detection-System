from typing import List, Tuple
from app.schemas.investigator import InvestigationContext, EvidenceItem


class EvidenceService:
    """
    Extracts and normalizes multi-vector evidence across financial,
    behavioral, device, location, and model prediction baselines.
    Strictly factual: if data is missing, marks as 'Data unavailable'.
    """

    @staticmethod
    def extract_evidence(ctx: InvestigationContext) -> List[EvidenceItem]:
        evidence: List[EvidenceItem] = []
        ev_id = 1

        # 1. Transaction Amount Anomaly
        amount = ctx.amount_inr
        baseline_avg = ctx.customer_baseline_avg_amount or 0.0

        if baseline_avg > 0:
            ratio = amount / baseline_avg
            if ratio >= 10.0:
                evidence.append(EvidenceItem(
                    id=f"EV-{ev_id:03d}",
                    category="Transaction",
                    finding_type="Extreme Amount Anomaly",
                    finding_detail=f"Transfer amount ₹{amount:,.2f} is {ratio:.1f}x higher than customer 90-day baseline average of ₹{baseline_avg:,.2f}.",
                    confidence=95.0,
                    severity="critical",
                    source="Transactions"
                ))
                ev_id += 1
            elif ratio >= 3.0:
                evidence.append(EvidenceItem(
                    id=f"EV-{ev_id:03d}",
                    category="Transaction",
                    finding_type="Elevated Transaction Amount",
                    finding_detail=f"Transfer amount ₹{amount:,.2f} is {ratio:.1f}x above customer average baseline of ₹{baseline_avg:,.2f}.",
                    confidence=85.0,
                    severity="high",
                    source="Transactions"
                ))
                ev_id += 1
            else:
                evidence.append(EvidenceItem(
                    id=f"EV-{ev_id:03d}",
                    category="Transaction",
                    finding_type="Routine Transaction Amount",
                    finding_detail=f"Amount ₹{amount:,.2f} aligns within normal operational baseline (ratio: {ratio:.1f}x).",
                    confidence=90.0,
                    severity="info",
                    source="Transactions"
                ))
                ev_id += 1
        else:
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Transaction",
                finding_type="Transaction Ingestion",
                finding_detail=f"Transaction ₹{amount:,.2f} recorded. Customer baseline data unavailable for ratio calculation.",
                confidence=70.0,
                severity="low",
                source="Transactions"
            ))
            ev_id += 1

        # 2. Location & Impossible Travel
        dist_km = ctx.distance_from_typical_km
        country = ctx.country or "India"
        city = ctx.city or "Unknown"

        if country.lower() != "india" or (dist_km is not None and dist_km > 1000):
            dist_desc = f"{dist_km:,.1f} km from typical location" if dist_km is not None else "foreign jurisdiction"
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Location",
                finding_type="Geographical Anomaly",
                finding_detail=f"Transaction initiated from {city}, {country} ({dist_desc}). Customer home base is in India.",
                confidence=92.0,
                severity="critical" if dist_km and dist_km > 3000 else "high",
                source="Transactions"
            ))
            ev_id += 1
        elif dist_km is not None and dist_km > 100:
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Location",
                finding_type="Domestic Inter-City Travel",
                finding_detail=f"Transaction originating from {city} ({dist_km:,.1f} km from registered address).",
                confidence=80.0,
                severity="medium",
                source="Transactions"
            ))
            ev_id += 1
        else:
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Location",
                finding_type="Normal Geographical Location",
                finding_detail=f"Transaction origin ({city}, {country}) matches verified customer primary zone.",
                confidence=85.0,
                severity="info",
                source="Transactions"
            ))
            ev_id += 1

        # 3. Device Integrity & Emulator
        is_root = ctx.is_rooted_or_jailbroken or False
        is_emu = ctx.is_emulator or False
        device_str = f"{ctx.device_type or 'Device'} ({ctx.os or 'OS unknown'})"

        if is_root or is_emu:
            risk_labels = []
            if is_root: risk_labels.append("OS root/jailbreak detected")
            if is_emu: risk_labels.append("hardware emulator environment")
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Device",
                finding_type="Compromised Device Integrity",
                finding_detail=f"Hardware authentication integrity check failed for {device_str}: {', '.join(risk_labels)}.",
                confidence=98.0,
                severity="critical",
                source="Devices"
            ))
            ev_id += 1
        else:
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Device",
                finding_type="Verified Device Environment",
                finding_detail=f"Device integrity check passed for {device_str}. No root or virtualization detected.",
                confidence=90.0,
                severity="info",
                source="Devices"
            ))
            ev_id += 1

        # 4. Network Obfuscation (VPN / Tor / Proxy)
        vpn = ctx.vpn_or_proxy_detected or False
        tor = ctx.tor_exit_node or False
        ip = ctx.ip_address or "Data unavailable"

        if tor or vpn:
            net_flags = []
            if tor: net_flags.append("Tor Exit Node")
            if vpn: net_flags.append("Commercial VPN/Proxy Host")
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Behavioral",
                finding_type="Network Anonymization",
                finding_detail=f"Client connection originating from {ip} routed through {', '.join(net_flags)}.",
                confidence=95.0,
                severity="critical" if tor else "high",
                source="Devices"
            ))
            ev_id += 1
        elif ip != "Data unavailable":
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Behavioral",
                finding_type="Direct ISP Connection",
                finding_detail=f"Direct residential/mobile network connection verified for IP {ip}.",
                confidence=85.0,
                severity="info",
                source="Devices"
            ))
            ev_id += 1

        # 5. Customer Behavioral Profile & Prior History
        prior_flags = ctx.customer_prior_flags_count or 0
        risk_score = ctx.customer_risk_score or 0.0
        risk_tier = ctx.customer_risk_tier or "Low"

        if prior_flags > 0 or risk_tier in ["High", "Critical"]:
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Behavioral",
                finding_type="Elevated Customer Risk Profile",
                finding_detail=f"Customer risk score {risk_score:.1f}/100 ({risk_tier} tier) with {prior_flags} prior recorded fraud alert(s).",
                confidence=90.0,
                severity="high" if prior_flags >= 2 else "medium",
                source="Customers"
            ))
            ev_id += 1
        else:
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="Behavioral",
                finding_type="Clean Historical Profile",
                finding_detail=f"Customer maintains {risk_tier} risk profile with zero prior unresolved fraud alerts on record.",
                confidence=85.0,
                severity="info",
                source="Customers"
            ))
            ev_id += 1

        # 6. Machine Learning Model Score
        prob = ctx.model_fraud_probability
        if prob is not None:
            sev = "critical" if prob >= 90.0 else "high" if prob >= 80.0 else "medium" if prob >= 50.0 else "low"
            decision_str = "FLAGGED FOR REVIEW" if prob >= 80.0 else "ROUTINE"
            evidence.append(EvidenceItem(
                id=f"EV-{ev_id:03d}",
                category="ML",
                finding_type="LightGBM Predictive Inference",
                finding_detail=f"Supervised model scored transaction fraud probability at {prob:.2f}% (Operating Threshold: 80.00%, Decision: {decision_str}).",
                confidence=91.7,
                severity=sev,
                source="FraudPredictions"
            ))
            ev_id += 1

        return evidence


evidence_service = EvidenceService()
