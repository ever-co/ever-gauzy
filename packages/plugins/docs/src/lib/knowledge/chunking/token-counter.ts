/**
 * Token counting for the markdown chunker (§6 of the AI-knowledge spec).
 *
 * `js-tiktoken` with the `cl100k_base` encoding — the tokenizer family of the default
 * embedding model. If the tokenizer fails to load (exotic runtime), fall back to the
 * `ceil(chars / 4)` heuristic; the counter actually used is reported per run so drift is
 * diagnosable (`metadata.indexing.tokenCounter`).
 */

/** Which counter produced the token counts of a chunking run. */
export type TokenCounterKind = 'cl100k_base' | 'chars/4';

export interface ITokenCounter {
	/** The counter identity recorded in the index metadata. */
	readonly kind: TokenCounterKind;
	/** Counts the tokens of one string. */
	count(text: string): number;
}

let cached: ITokenCounter | null = null;

/**
 * The `ceil(chars / 4)` fallback counter.
 */
export const heuristicTokenCounter: ITokenCounter = {
	kind: 'chars/4',
	count: (text: string): number => Math.ceil((text ?? '').length / 4)
};

/**
 * Resolves the process-wide token counter: `cl100k_base` when `js-tiktoken` loads,
 * else the chars/4 heuristic. The result is cached — encoder construction is expensive.
 */
export function getTokenCounter(): ITokenCounter {
	if (cached) {
		return cached;
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { getEncoding } = require('js-tiktoken');
		const encoding = getEncoding('cl100k_base');
		cached = {
			kind: 'cl100k_base',
			count: (text: string): number => encoding.encode(text ?? '').length
		};
	} catch {
		cached = heuristicTokenCounter;
	}
	return cached;
}

/**
 * Test seam: resets the cached counter.
 */
export function resetTokenCounterCache(): void {
	cached = null;
}
