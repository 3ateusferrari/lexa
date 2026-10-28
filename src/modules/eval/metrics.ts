export interface QuestionEvalOutcome {
  question: string;
  expectedArticle: string | null;
  expectedDocumentId?: string | null;
  retrievedArticles: Array<string | null>;
  retrievedDocumentIds?: string[];
  retrievedContents?: string[];
  refused: boolean;
}

export interface BatchEvalMetrics {
  hitRateAtK: number;
  mrr: number;
  refusalAccuracy: number;
  answerableCount: number;
  unanswerableCount: number;
}

function normalizeArticleForMatch(article: string): string {
  return article
    .toLowerCase()
    .replace(/°/g, 'º')
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim();
}

export function articleMatches(
  candidateArticle: string | null | undefined,
  expectedArticle: string,
  candidateContent?: string,
): boolean {
  const normExpected = normalizeArticleForMatch(expectedArticle);
  if (candidateArticle && normalizeArticleForMatch(candidateArticle) === normExpected) {
    return true;
  }
  if (candidateContent) {
    const escaped = normExpected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(candidateContent.replace(/°/g, 'º'));
  }
  return false;
}

export function calculateQuestionHit(
  retrievedArticles: Array<string | null>,
  expectedArticle: string,
  k = 5,
  retrievedContents?: string[],
  expectedDocumentId?: string | null,
  retrievedDocumentIds?: string[],
): boolean {
  const limit = Math.min(k, retrievedArticles.length);
  for (let i = 0; i < limit; i++) {
    if (
      expectedDocumentId &&
      retrievedDocumentIds &&
      retrievedDocumentIds[i] &&
      retrievedDocumentIds[i] !== expectedDocumentId
    ) {
      continue;
    }
    if (articleMatches(retrievedArticles[i], expectedArticle, retrievedContents?.[i])) {
      return true;
    }
  }
  return false;
}

export function calculateReciprocalRank(
  retrievedArticles: Array<string | null>,
  expectedArticle: string,
  k = 5,
  retrievedContents?: string[],
  expectedDocumentId?: string | null,
  retrievedDocumentIds?: string[],
): number {
  const limit = Math.min(k, retrievedArticles.length);
  for (let i = 0; i < limit; i++) {
    if (
      expectedDocumentId &&
      retrievedDocumentIds &&
      retrievedDocumentIds[i] &&
      retrievedDocumentIds[i] !== expectedDocumentId
    ) {
      continue;
    }
    if (articleMatches(retrievedArticles[i], expectedArticle, retrievedContents?.[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

export function evaluateBatchMetrics(
  outcomes: QuestionEvalOutcome[],
  k = 5,
): BatchEvalMetrics {
  const answerable = outcomes.filter((o) => o.expectedArticle !== null);
  const unanswerable = outcomes.filter((o) => o.expectedArticle === null);

  let hits = 0;
  let rrSum = 0;

  for (const item of answerable) {
    if (item.refused) {
      continue;
    }
    const expected = item.expectedArticle!;
    const hit = calculateQuestionHit(
      item.retrievedArticles,
      expected,
      k,
      item.retrievedContents,
      item.expectedDocumentId,
      item.retrievedDocumentIds,
    );
    if (hit) hits++;

    rrSum += calculateReciprocalRank(
      item.retrievedArticles,
      expected,
      k,
      item.retrievedContents,
      item.expectedDocumentId,
      item.retrievedDocumentIds,
    );
  }

  let correctRefusals = 0;
  for (const item of unanswerable) {
    if (item.refused) {
      correctRefusals++;
    }
  }

  const hitRateAtK = answerable.length > 0 ? Number((hits / answerable.length).toFixed(4)) : 0;
  const mrr = answerable.length > 0 ? Number((rrSum / answerable.length).toFixed(4)) : 0;
  const refusalAccuracy =
    unanswerable.length > 0
      ? Number((correctRefusals / unanswerable.length).toFixed(4))
      : 1;

  return {
    hitRateAtK,
    mrr,
    refusalAccuracy,
    answerableCount: answerable.length,
    unanswerableCount: unanswerable.length,
  };
}
