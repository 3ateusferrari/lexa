export interface QualityGateMetrics {
  hitRate: number;
  mrr: number;
  refusalAccuracy?: number;
}

export interface QualityGateThresholds {
  minHitRateAt5: number;
  minMrr: number;
}

export interface QualityGateVerdict {
  passed: boolean;
  failures: string[];
  metrics: QualityGateMetrics;
  thresholds: QualityGateThresholds;
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityGateThresholds = {
  minHitRateAt5: 0.75,
  minMrr: 0.6
};

export function evaluateQualityGate(
  metrics: QualityGateMetrics,
  thresholds: QualityGateThresholds = DEFAULT_QUALITY_THRESHOLDS
): QualityGateVerdict {
  const failures: string[] = [];

  if (metrics.hitRate < thresholds.minHitRateAt5) {
    failures.push(
      `Hit Rate@5 (${(metrics.hitRate * 100).toFixed(1)}%) abaixo do mínimo exigido (${(
        thresholds.minHitRateAt5 * 100
      ).toFixed(1)}%)`
    );
  }

  if (metrics.mrr < thresholds.minMrr) {
    failures.push(
      `MRR (${metrics.mrr.toFixed(4)}) abaixo do mínimo exigido (${thresholds.minMrr.toFixed(
        4
      )})`
    );
  }

  return {
    passed: failures.length === 0,
    failures,
    metrics,
    thresholds
  };
}
