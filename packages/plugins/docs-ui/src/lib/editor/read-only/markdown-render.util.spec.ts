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
 *
 * 🛑 And `javascript:` is not the property to test for. Angular's URL check is a DENYLIST of
 * that one scheme, so a test that only asks "did the `javascript:` go away?" passes while
 * `data:text/html`, `data:image/svg+xml` and `vbscript:` render untouched. The dangerous-URL
 * assertions below therefore go through `isAllowedUrl` — the app's scheme ALLOWLIST — and the
 * matrix at the bottom pins exactly where Angular stops and the allowlist takes over.
 */
import { DomSanitizer, ɵDomSanitizerImpl as DomSanitizerImpl } from '@angular/platform-browser';
import { renderMarkdownToSanitizedHtml, sanitizeHtml } from './markdown-render.util';
import { isAllowedUrl } from './safe-url.util';

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
			const anchor = parse(result).querySelector('a');

			// The attribute is dropped outright now, so there is nothing left to resolve.
			expect(anchor?.hasAttribute('href')).toBe(false);
			expect(isAllowedUrl(anchor?.getAttribute('href'))).toBe(false);
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

		it.each([
			['data:text/html', '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">click</a>'],
			['vbscript:', '<a href="vbscript:msgbox(1)">click</a>'],
			['uppercase VBScript:', '<a href="VBScript:msgbox(1)">click</a>'],
			['entity-encoded javascript:', '<a href="&#106;avascript:alert(1)">click</a>'],
			['tab-split javascript:', '<a href="jav&#9;ascript:alert(1)">click</a>'],
			['newline-padded javascript:', '<a href="&#10; javascript:alert(1)">click</a>'],
			['leading-whitespace javascript:', '<a href="   javascript:alert(1)">click</a>'],
			['file:', '<a href="file:///etc/passwd">click</a>']
		])('drops a %s href', (_label, html) => {
			const anchor = parse(sanitizeHtml(html, sanitizer)).querySelector('a');

			expect(anchor?.hasAttribute('href')).toBe(false);
			// The link text survives — the content is rendered, only the URL is refused.
			expect(anchor?.textContent).toContain('click');
		});

		it('drops a scriptable data: image source but keeps a raster one', () => {
			const scriptable = parse(
				sanitizeHtml('<img src="data:image/svg+xml,%3Csvg%20onload%3Dalert(1)%3E" alt="a">', sanitizer)
			).querySelector('img');
			const raster = parse(
				sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="a">', sanitizer)
			).querySelector('img');

			expect(scriptable?.hasAttribute('src')).toBe(false);
			expect(raster?.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
		});

		it('drops a srcset whose candidate list smuggles a dangerous scheme', () => {
			const image = parse(
				sanitizeHtml('<img src="https://cdn.ever.co/a.png" srcset="vbscript:msgbox(1) 2x">', sanitizer)
			).querySelector('img');

			expect(image?.hasAttribute('srcset')).toBe(false);
			expect(image?.getAttribute('src')).toBe('https://cdn.ever.co/a.png');
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
			const anchor = dom.querySelector('a');

			expect(anchor?.hasAttribute('href')).toBe(false);
			expect(isAllowedUrl(anchor?.getAttribute('href'))).toBe(false);
		});

		it.each([
			['data:text/html', '[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
			['data:image/svg+xml', '[click](data:image/svg+xml,%3Csvg%20onload%3Dalert%281%29%3E)'],
			['vbscript:', '[click](vbscript:msgbox%281%29)'],
			['uppercase JavaScript:', '[click](JaVaScRiPt:alert%281%29)'],
			['file:', '[click](file:///etc/passwd)']
		])('drops a %s markdown link, which Angular alone lets through', (_label, markdown) => {
			const anchor = parse(renderMarkdownToSanitizedHtml(markdown, sanitizer)).querySelector('a');

			expect(anchor?.hasAttribute('href')).toBe(false);
			expect(parse(renderMarkdownToSanitizedHtml(markdown, sanitizer)).textContent).toContain('click');
		});

		it('drops a data:image/svg+xml image source', () => {
			const dom = parse(
				renderMarkdownToSanitizedHtml(
					'![x](data:image/svg+xml,%3Csvg%20onload%3Dalert%281%29%3E)',
					sanitizer
				)
			);

			expect(dom.querySelector('img')?.hasAttribute('src')).toBe(false);
		});

		it('keeps the links and images real content is made of', () => {
			const dom = parse(
				renderMarkdownToSanitizedHtml(
					'[site](https://ever.co/a?b=1#c) [mail](mailto:ever@ever.co) [rel](/api/documents/1)' +
						'\n\n![shot](https://cdn.ever.co/a.png)\n\n![inline](data:image/png;base64,iVBORw0KGgo=)',
					sanitizer
				)
			);
			const hrefs = Array.from(dom.querySelectorAll('a')).map((a) => a.getAttribute('href'));
			const sources = Array.from(dom.querySelectorAll('img')).map((img) => img.getAttribute('src'));

			expect(hrefs).toEqual(['https://ever.co/a?b=1#c', 'mailto:ever@ever.co', '/api/documents/1']);
			expect(sources).toEqual(['https://cdn.ever.co/a.png', 'data:image/png;base64,iVBORw0KGgo=']);
		});

		it('returns null for empty input', () => {
			expect(renderMarkdownToSanitizedHtml('', sanitizer)).toBeNull();
			expect(renderMarkdownToSanitizedHtml(null, sanitizer)).toBeNull();
			expect(renderMarkdownToSanitizedHtml(undefined, sanitizer)).toBeNull();
		});
	});
});
