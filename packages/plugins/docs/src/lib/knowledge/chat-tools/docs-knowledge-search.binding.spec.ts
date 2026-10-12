import { readFileSync } from 'fs';
import { join } from 'path';
import { DOCS_KNOWLEDGE_SEARCH_SERVICE } from './docs-knowledge-search.types';

/**
 * Regression guard for a binding that fails SILENTLY.
 *
 * `DocsChatToolsService` injects the retrieval service with `@Optional() @Inject(
 * DOCS_KNOWLEDGE_SEARCH_SERVICE)` so that a process without the knowledge pipeline still boots.
 * The cost of that tolerance: if the provider in `docs.module.ts` is ever dropped or renamed,
 * **nothing fails** — no boot error, no failing DI test. The chat tools would simply answer every
 * knowledge question with "no results" forever, which reads as "the AI found nothing" rather than
 * as a wiring bug.
 *
 * This is deliberately a SOURCE-level assertion rather than a DI test: instantiating `DocsModule`
 * would drag in TypeORM/MikroORM connections and the whole knowledge pipeline, and a DI test that
 * needed that much scaffolding would be the first thing disabled when it got slow. Reading the
 * module source is exact for the one thing that matters here — that the token is still bound.
 */
describe('DOCS_KNOWLEDGE_SEARCH_SERVICE binding', () => {
	const moduleSource = readFileSync(join(__dirname, '..', '..', 'docs.module.ts'), 'utf8');

	it('is provided in docs.module.ts, so the chat tools actually receive a retrieval service', () => {
		// Tolerates formatting/reordering, but not the provider going missing.
		expect(moduleSource).toMatch(
			/provide:\s*DOCS_KNOWLEDGE_SEARCH_SERVICE\s*,\s*useExisting:\s*DocumentKnowledgeSearchService/
		);
	});

	it('imports the implementation it binds', () => {
		expect(moduleSource).toMatch(/import\s*\{[^}]*DocumentKnowledgeSearchService[^}]*\}\s*from/);
	});

	it('keeps the token value stable (it is referenced as a string in the module)', () => {
		// The provider is matched above by identifier; if the token's VALUE ever drifted from its
		// name, an `@Inject('DOCS_KNOWLEDGE_SEARCH_SERVICE')` elsewhere would quietly miss it.
		expect(DOCS_KNOWLEDGE_SEARCH_SERVICE).toBe('DOCS_KNOWLEDGE_SEARCH_SERVICE');
	});
});
