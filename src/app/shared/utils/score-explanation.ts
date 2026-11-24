import { FraudPredictionResultDto } from '../../models/api-response.model';
import { Transaction } from '../../models/transaction.model';

export type Provenance = 'transaction' | 'approximated' | 'placeholder' | 'not_provided';

export interface ExplanationFactor {
  feature: string;
  label: string;
  valueText: string;
  contribution: number;
  direction: 'up' | 'down';
  /** Bar width, 0-100, relative to the largest contribution shown. */
  widthPct: number;
  /** Where the model input came from; unknown/absent is shown as approximated (never claimed to be real). */
  provenance: Provenance;
  /** Short badge text for inputs that are not straight from the transaction, or null for ones that are. */
  provenanceTag: string | null;
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

const PROVENANCE_TAGS: Record<Provenance, string | null> = {
  transaction: null,
  approximated: 'approximated',
  placeholder: 'placeholder',
  not_provided: 'not provided'
};

export function normalizeProvenance(value: string | null | undefined): Provenance {
  return value === 'transaction' || value === 'placeholder' || value === 'not_provided' ? value : 'approximated';
}

type ExplainableResult = Pick<FraudPredictionResultDto, 'fraudProbability' | 'calibratedProbability' | 'topFactors'>;

/**
 * Turns the API prediction result into what the panel shows. Probabilities arrive as 0-1 and are shown as
 * percentages; factors keep the engine's order (largest absolute contribution first) and get bar widths.
 */
export function buildScoreExplanation(result: ExplainableResult): ScoreExplanation {
  const factors = result.topFactors ?? [];
  const maxAbs = factors.reduce((m, f) => Math.max(m, Math.abs(f.contribution)), 0);

  return {
    modelScorePct: result.fraudProbability * 100,
    calibratedPct:
      result.calibratedProbability === null || result.calibratedProbability === undefined
        ? null
        : result.calibratedProbability * 100,
    factors: factors.map(f => {
      const provenance = normalizeProvenance(f.provenance);
      return {
        feature: f.feature,
        label: featureLabel(f.feature),
        valueText: formatFactorValue(f.value),
        contribution: f.contribution,
        direction: f.contribution >= 0 ? 'up' : 'down',
        widthPct: maxAbs > 0 ? Math.round((Math.abs(f.contribution) / maxAbs) * 100) : 0,
        provenance,
        provenanceTag: PROVENANCE_TAGS[provenance]
      };
    })
  };
}

/**
 * The explanation stored with a transaction's prediction (from the detail endpoint), or null when there is none.
 * Transaction.probability is already a percentage of the uncalibrated model score.
 */
export function buildStoredExplanation(txn: Pick<Transaction, 'probability' | 'calibratedProbability' | 'topFactors'>): ScoreExplanation | null {
  const hasCalibrated = txn.calibratedProbability !== null && txn.calibratedProbability !== undefined;
  const hasFactors = !!txn.topFactors && txn.topFactors.length > 0;
  if (!hasCalibrated && !hasFactors) return null;
  return buildScoreExplanation({
    fraudProbability: txn.probability / 100,
    calibratedProbability: txn.calibratedProbability,
    topFactors: txn.topFactors
  });
}
