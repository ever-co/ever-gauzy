/**
 * Reciprocal Rank Fusion (§9.4 of the AI-knowledge spec) — pure functions.
 *
 * `score(chunk) = Σ over legs that ranked it: 1 / (K + rank)` with K = 60, rank 1-based.
 * Fusion is client-side over the ranked lists, deduped by chunk id, sorted by fused
 * score, truncated to `topK`.
 */

export const RRF_K = 60;

/** ≈ 0.0154 — "top-5 of at least one leg". Below it, results carry a low-confidence caveat. */
export const RRF_CONFIDENCE_FLOOR = 1 / (RRF_K + 5);

/** The minimal ranked-hit shape fusion needs. */
export interface IRankedHit {
	/** Dedupe key across legs. */
	chunkId: string;
}

/** One fused result: the first-seen hit payload plus the fused score. */
export interface IFusedHit<T extends IRankedHit> {
	hit: T;
	/** The RRF-fused score. */
	score: number;
	/** Which leg indices (0-based) ranked this chunk. */
	legs: number[];
}

/**
 * Fuses ranked lists with Reciprocal Rank Fusion.
 *
 * @param legs The ranked lists (already sorted best-first), one per retrieval leg.
 * @param topK Result cap after fusion.
 * @param k The RRF constant (default 60).
 * @returns Fused hits sorted by fused score descending, deduped by `chunkId`.
 */
export function fuseRrf<T extends IRankedHit>(legs: T[][], topK: number, k: number = RRF_K): Array<IFusedHit<T>> {
	const fused = new Map<string, IFusedHit<T>>();

	legs.forEach((leg, legIndex) => {
		leg.forEach((hit, position) => {
			const rank = position + 1; // 1-based
			const contribution = 1 / (k + rank);
			const existing = fused.get(hit.chunkId);
			if (existing) {
				existing.score += contribution;
				existing.legs.push(legIndex);
			} else {
				fused.set(hit.chunkId, { hit, score: contribution, legs: [legIndex] });
			}
		});
	});

	return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, Math.max(0, topK));
}
