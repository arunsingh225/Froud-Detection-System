import { FraudPredictionResultDto } from '../../models/api-response.model';

export interface ExplanationFactor {
  feature: string;
  label: string;
  valueText: string;
  contribution: number;
  direction: 'up' | 'down';
  /** Bar width, 0-100, relative to the largest contribution shown. */
  widthPct: number;
}

export interface ScoreExplanation {
  /** Uncalibrated model score as a percentage; it drives risk tiers and the flag decision. */
  modelScorePct: number;
  /** Calibrated estimate of the true fraud probability as a percentage, or null when unavailable. */
  calibratedPct: number | null;
  factors: ExplanationFactor[];
}

/** "P_emaildomain" -> "P emaildomain", "card1_card2" -> "card1 card2" (kept close to the model feature names). */
export function featureLabel(feature: string): string {
  return feature.replace(/_/g, ' ');
}

export function formatFactorValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'missing';
  return Number.isInteger(value) ? value.toLocaleString('en-US') : value.toFixed(2);
}

/**
 * Turns the API prediction result into what the panel shows. Probabilities arrive as 0-1 and are shown as
 * percentages; factors keep the engine's order (largest absolute contribution first) and get bar widths.
 */
export function buildScoreExplanation(result: FraudPredictionResultDto): ScoreExplanation {
  const factors = result.topFactors ?? [];
  const maxAbs = factors.reduce((m, f) => Math.max(m, Math.abs(f.contribution)), 0);

  return {
    modelScorePct: result.fraudProbability * 100,
    calibratedPct:
      result.calibratedProbability === null || result.calibratedProbability === undefined
        ? null
        : result.calibratedProbability * 100,
    factors: factors.map(f => ({
      feature: f.feature,
      label: featureLabel(f.feature),
      valueText: formatFactorValue(f.value),
      contribution: f.contribution,
      direction: f.contribution >= 0 ? 'up' : 'down',
      widthPct: maxAbs > 0 ? Math.round((Math.abs(f.contribution) / maxAbs) * 100) : 0
    }))
  };
}
