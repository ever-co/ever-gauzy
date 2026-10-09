import { randomUUID } from 'crypto';
import { ID } from '@gauzy/contracts';

/**
 * Cost-accounting event emitted by every embedding and classification call site
 * (§7.4 of the AI-knowledge spec).
 *
 * P0 consumes this with a structured-log handler only; P2 adds the daily rollup + budget
 * enforcement. No prompt or document content is ever included in the event.
 *
 * Structurally compatible with the core event bus's `BaseEvent` (`id` + `createdAt`) —
 * the base class itself is not part of the public `@gauzy/core` surface.
 */
export class DocsAiUsageEvent {
	/** Unique event id (BaseEvent shape). */
	public readonly id: ID = randomUUID();
	/** Emission timestamp (BaseEvent shape). */
	public readonly createdAt: Date = new Date();

	constructor(
		public readonly payload: {
			tenantId: ID;
			organizationId: ID;
			feature: 'docs-classify' | 'docs-embed' | 'docs-query-embed' | 'docs-ocr';
			providerId: string;
			model: string;
			/** Provider-reported; `ceil(chars/4)` estimate when absent. */
			inputTokens: number;
			outputTokens: number;
			/** True when the token counts are estimates. */
			estimated: boolean;
			durationMs: number;
			success: boolean;
		}
	) {}
}
