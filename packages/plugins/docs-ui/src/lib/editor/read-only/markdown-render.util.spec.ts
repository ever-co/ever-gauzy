/**
 * Read-only render sanitization (`05-editor-spec.md` §9.1, `08-permissions-security.md` §7).
 *
 * Everything this module renders is ATTACKER-CONTROLLED: an uploaded HTML or markdown file,
 * a page authored by another user in the tenant, or a legacy import. It used to finish with
 * `bypassSecurityTrustHtml(...)`, which marked that content as trusted and switched off the
 * sanitizer pass Angular would otherwise run at binding time. These tests pin the two
 * properties that replaced it: the output is a PLAIN STRING (so `[innerHTML]` still sanitizes
 * it), and the dangerous constructs do not survive.
 *
 * Assertions are made against a parsed DOM rather than the raw string on purpose — Angular
 * neutralizes a `javascript:` URL by rewriting it to `unsafe:javascript:…` rather than
 * deleting it, so a naive `not.toContain('javascript:')` would fail while the markup is in
 * fact inert.
 */
import { DomSanitizer, ɵDomSanitizerImpl as DomSanitizerImpl } from '@angular/platform-browser';
import { renderMarkdownToSanitizedHtml, sanitizeHtml } from './markdown-render.util';

describe('read-only render sanitization', () => {
	/**
	 * The REAL Angular sanitizer, constructed directly instead of injected.
	 *
	 * `TestBed` cannot be used in this package: `@angular/platform-browser` resolves its own
	 * nested copy of `@angular/core` in this workspace, so `initTestEnvironment`'s
	 * `BrowserTestingModule` and the test's `@angular/core/testing` disagree about module
	 * identity and `TestBed.inject` dies on a null NgModule. Every other spec here sidesteps
	 * TestBed for the same reason (see the note atop `documents.service.spec.ts`).
	 *
	 * `ɵDomSanitizerImpl` is the exact class Angular's own root provider instantiates, and its
	 * only constructor argument is the document — so this exercises the genuine allowlist
	 * sanitizer rather than a stub, which is the whole point of these tests.
	 */
	const sanitizer: DomSanitizer = new DomSanitizerImpl(document);

	/** Parses rendered output so assertions describe DOM semantics, not string shape. */
	const parse = (html: string | null): HTMLElement => {
		const host = document.createElement('div');
		host.innerHTML = html ?? '';
		return host;
	};

	describe('sanitizeHtml', () => {
		it('returns a plain string, never a trusted SafeHtml wrapper', () => {
			const result = sanitizeHtml('<p>hello</p>', sanitizer);

			// A `SafeHtml` would be an object; a string is re-sanitized by `[innerHTML]`.
			expect(typeof result).toBe('string');
			expect(result).toContain('hello');
		});

		it('drops a script tag', () => {
			const result = sanitizeHtml('<p>before</p><script>alert(1)</script><p>after</p>', sanitizer);
			const dom = parse(result);

			expect(dom.querySelector('script')).toBeNull();
			expect(result).not.toContain('alert(1)');
			expect(dom.textContent).toContain('before');
			expect(dom.textContent).toContain('after');
		});

		it('drops an onerror handler while keeping the element', () => {
			const result = sanitizeHtml('<img src="x" onerror="alert(1)" alt="a" />', sanitizer);
			const dom = parse(result);

			expect(dom.querySelector('[onerror]')).toBeNull();
			expect(dom.querySelector('img')?.getAttribute('onerror')).toBeNull();
			expect(result).not.toContain('alert(1)');
		});

		it('neutralizes a javascript: URL', () => {
			const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>', sanitizer);
			const href = parse(result).querySelector('a')?.getAttribute('href') ?? '';

			expect(href.toLowerCase().startsWith('javascript:')).toBe(false);
			expect(parse(result).textContent).toContain('click');
		});

		it('strips every inline event handler, not just onerror', () => {
			const result = sanitizeHtml(
				'<div onclick="a()" onmouseover="b()" onload="c()">text</div>',
				sanitizer
			);
			const dom = parse(result);

			expect(dom.querySelector('[onclick]')).toBeNull();
			expect(dom.querySelector('[onmouseover]')).toBeNull();
			expect(dom.querySelector('[onload]')).toBeNull();
		});

		it('collapses to null when nothing survives sanitization', () => {
			expect(sanitizeHtml('<script>alert(1)</script>', sanitizer)).toBeNull();
			expect(sanitizeHtml('', sanitizer)).toBeNull();
			expect(sanitizeHtml(null, sanitizer)).toBeNull();
			expect(sanitizeHtml(undefined, sanitizer)).toBeNull();
		});
	});

	describe('renderMarkdownToSanitizedHtml', () => {
		it('renders ordinary markdown', () => {
			const dom = parse(renderMarkdownToSanitizedHtml('# Title\n\nSome **bold** text.', sanitizer));

			expect(dom.querySelector('h1')?.textContent).toContain('Title');
			expect(dom.querySelector('strong')?.textContent).toContain('bold');
		});

		it('sanitizes raw HTML embedded in markdown', () => {
			// `marked` passes raw HTML through by design, so the sanitizer is the only guard.
			const dom = parse(
				renderMarkdownToSanitizedHtml(
					'Intro text\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">',
					sanitizer
				)
			);

			expect(dom.querySelector('script')).toBeNull();
			expect(dom.querySelector('[onerror]')).toBeNull();
			expect(dom.textContent).toContain('Intro text');
		});

		it('neutralizes a javascript: URL written as a markdown link', () => {
			const dom = parse(renderMarkdownToSanitizedHtml('[click](javascript:alert(1))', sanitizer));
			const href = dom.querySelector('a')?.getAttribute('href') ?? '';

			expect(href.toLowerCase().startsWith('javascript:')).toBe(false);
		});

		it('returns null for empty input', () => {
			expect(renderMarkdownToSanitizedHtml('', sanitizer)).toBeNull();
			expect(renderMarkdownToSanitizedHtml(null, sanitizer)).toBeNull();
			expect(renderMarkdownToSanitizedHtml(undefined, sanitizer)).toBeNull();
		});
	});
});
