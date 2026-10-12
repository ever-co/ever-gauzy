/**
 * Public-page rich-text sanitization (`08-permissions-security.md` §6).
 *
 * `/public/:profile_link` is served to ANONYMOUS visitors and renders two editor-authored HTML
 * fields — `Employee.description` and `Organization.overview`. Both used to reach `[innerHtml]`
 * through the shared `safeHtml` pipe, i.e. `bypassSecurityTrustHtml`, which switches Angular's
 * sanitizer off; a payload stored once by any tenant user then executed for every visitor.
 *
 * These tests pin the two properties that replaced it: the pipe returns a PLAIN STRING (so
 * `[innerHtml]` sanitizes it a second time, authoritatively), and the three payload shapes the
 * audit called out — a `script` element, an event-handler attribute, and a `javascript:` URL —
 * do not survive.
 *
 * Assertions run against a parsed DOM rather than the raw string on purpose: Angular neutralizes
 * a `javascript:` URL by rewriting it to `unsafe:javascript:…` instead of deleting it, so a naive
 * `not.toContain('javascript:')` would fail on markup that is in fact inert.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { DomSanitizer, ɵDomSanitizerImpl as DomSanitizerImpl } from '@angular/platform-browser';
import { SanitizeHtmlPipe } from './sanitize-html.pipe';

describe('SanitizeHtmlPipe', () => {
	/**
	 * The REAL Angular sanitizer, constructed directly rather than stubbed — `ɵDomSanitizerImpl`
	 * is the exact class Angular's own root provider instantiates and takes only the document.
	 * Testing against a stub would prove nothing about the allowlist that actually runs.
	 */
	const injector = Injector.create({
		providers: [{ provide: DomSanitizer, useValue: new DomSanitizerImpl(document) }]
	});

	/** Builds the pipe inside an injection context, the way Angular instantiates it. */
	const pipe = (): SanitizeHtmlPipe => runInInjectionContext(injector, () => new SanitizeHtmlPipe());

	/** Parses output so assertions describe DOM semantics, not string shape. */
	const parse = (html: string): HTMLElement => {
		const host = document.createElement('div');
		host.innerHTML = html;
		return host;
	};

	it('returns a plain string, never a trusted SafeHtml wrapper', () => {
		const result = pipe().transform('<p>hello</p>');

		// A `SafeHtml` would be an object, and `[innerHtml]` would render it unchecked.
		expect(typeof result).toBe('string');
		expect(result).toContain('hello');
	});

	it('drops a script tag', () => {
		const result = pipe().transform('<p>before</p><script>alert(1)</script><p>after</p>');
		const dom = parse(result);

		expect(dom.querySelector('script')).toBeNull();
		expect(result).not.toContain('alert(1)');
		expect(dom.textContent).toContain('before');
		expect(dom.textContent).toContain('after');
	});

	it('drops an event-handler attribute while keeping the element', () => {
		const result = pipe().transform('<img src="https://cdn.example/a.png" onerror="alert(1)" alt="a" />');
		const dom = parse(result);
		const img = dom.querySelector('img');

		expect(img).not.toBeNull();
		expect(img?.getAttribute('onerror')).toBeNull();
		expect(result).not.toContain('onerror');
	});

	it('neutralizes a javascript: URL', () => {
		const result = pipe().transform('<a href="javascript:alert(1)">click</a>');
		const href = parse(result).querySelector('a')?.getAttribute('href') ?? '';

		// Angular rewrites rather than deletes — what matters is that the browser will not
		// resolve it as a script URL.
		expect(href.startsWith('javascript:')).toBe(false);
		expect(dangerousScheme(href)).toBe(false);
	});

	it.each([
		['uppercase', '<a href="JaVaScRiPt:alert(1)">x</a>'],
		['entity-encoded', '<a href="jav&#97;script:alert(1)">x</a>'],
		['tab-split', '<a href="jav&#9;ascript:alert(1)">x</a>'],
		['leading whitespace', '<a href="  javascript:alert(1)">x</a>']
	])('neutralizes a javascript: URL smuggled as %s', (_label: string, html: string) => {
		const href = parse(pipe().transform(html)).querySelector('a')?.getAttribute('href') ?? '';

		expect(dangerousScheme(href)).toBe(false);
	});

	it('drops an inline style element and a foreign embed', () => {
		const result = pipe().transform(
			'<style>p{display:none}</style><iframe src="https://evil.example"></iframe><p>ok</p>'
		);
		const dom = parse(result);

		expect(dom.querySelector('style')).toBeNull();
		expect(dom.querySelector('iframe')).toBeNull();
		expect(dom.textContent).toContain('ok');
	});

	it('leaves legitimate editor output intact', () => {
		const result = pipe().transform(
			'<p><strong>Bold</strong> and <em>italic</em></p><ul><li>one</li></ul>' +
				'<a href="https://ever.co">link</a>'
		);
		const dom = parse(result);

		expect(dom.querySelector('strong')?.textContent).toBe('Bold');
		expect(dom.querySelector('em')?.textContent).toBe('italic');
		expect(dom.querySelectorAll('li')).toHaveLength(1);
		expect(dom.querySelector('a')?.getAttribute('href')).toBe('https://ever.co');
	});

	it('is idempotent, so re-rendering stored output never changes it', () => {
		const once = pipe().transform('<p>hi</p><script>alert(1)</script>');

		expect(pipe().transform(once)).toBe(once);
	});

	it.each([
		['null', null],
		['undefined', undefined],
		['empty string', '']
	])('renders nothing for %s', (_label: string, value: string | null | undefined) => {
		expect(pipe().transform(value)).toBe('');
	});
});

/**
 * Whether a rendered URL still carries a scheme a browser would execute. Deliberately broader
 * than `javascript:` — Angular's own check is a denylist of that single scheme.
 */
function dangerousScheme(url: string): boolean {
	const normalized = url.replace(/[\u0000-\u0020\u00a0\ufeff]/g, '').toLowerCase();
	return /^(javascript|vbscript|data):/.test(normalized);
}
