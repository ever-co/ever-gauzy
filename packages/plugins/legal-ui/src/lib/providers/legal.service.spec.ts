import { HttpClient } from '@angular/common/http';
import { LegalService } from './legal.service';
import { LegalDocumentSlug } from '../models/legal-document.model';
import { LEGAL_CORPUS, LEGAL_DEFAULT_LOCALE, LEGAL_PRODUCT } from '../content';

/**
 * The legal text is bundled with the build. Any HTTP request made while rendering Terms, Privacy
 * or Cookies is a regression - that is exactly how these pages used to go blank when the remote
 * provider was unreachable.
 */
const http = {
	get: () => {
		throw new Error('Rendering a bundled legal document must not perform an HTTP request');
	}
} as unknown as HttpClient;

describe('LegalService', () => {
	const service = new LegalService(http);
	const slugs: LegalDocumentSlug[] = ['tos', 'privacy', 'cookies'];

	describe.each(slugs)('%s', (slug) => {
		it('is served from the bundled corpus, with no network access', () => {
			const document = service.getDocument(slug);

			expect(document).toBeTruthy();
			expect(document.document).toBe(slug);
			expect(document.product).toBe(LEGAL_PRODUCT);
			expect(document.locale).toBe(LEGAL_DEFAULT_LOCALE);
		});

		it('carries a non-empty body', () => {
			expect(service.getDocument(slug).html.length).toBeGreaterThan(1000);
		});

		it('exposes the version and effective date the page header renders', () => {
			const document = service.getDocument(slug);

			expect(document.title).toBeTruthy();
			expect(document.version).toMatch(/^\d+\.\d+\.\d+$/);
			expect(document.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(document.sha256).toMatch(/^[0-9a-f]{64}$/);
		});

		it('contains no executable markup', () => {
			const { html } = service.getDocument(slug);

			expect(html).not.toMatch(/<\s*(script|iframe|object|embed|style)\b/i);
			expect(html).not.toMatch(/\son[a-z]+\s*=/i);
		});
	});

	it('bundles each document exactly once', () => {
		const keys = LEGAL_CORPUS.map((document) => `${document.document}:${document.locale}`);

		expect(new Set(keys).size).toBe(keys.length);
		expect(keys.length).toBe(slugs.length);
	});

	it('falls back to the default locale for a language the corpus does not carry', () => {
		expect(service.getDocument('tos', 'de-DE').locale).toBe(LEGAL_DEFAULT_LOCALE);
		expect(service.getDocument('tos', '').locale).toBe(LEGAL_DEFAULT_LOCALE);
		expect(service.getDocument('tos', undefined).locale).toBe(LEGAL_DEFAULT_LOCALE);
	});

	it('returns null for a document the corpus does not carry', () => {
		expect(service.getDocument('nope' as LegalDocumentSlug)).toBeNull();
	});
});
