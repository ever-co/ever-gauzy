/**
 * Why `DocsPreviewModalComponent.mediaUrl` is a plain string and not a `SafeUrl`, and why it is
 * assigned through `sanitizeMediaUrl` rather than raw.
 *
 * The component used to bind `bypassSecurityTrustUrl(URL.createObjectURL(blob))` into
 * `<img [src]>` / `<video [src]>` / `<audio [src]>`. That bypass was pure cost: it switched
 * off Angular's URL check on a binding that renders ATTACKER-SUPPLIED files, in exchange for
 * nothing — `blob:` URLs are already permitted by the sanitizer. Worse, it would have kept
 * quietly "working" if the URL source were ever changed to something attacker-influenced.
 *
 * The claim "Angular passes `blob:` through untouched" is the entire justification for that
 * removal, so it is pinned here rather than left as a comment. If a future Angular tightens
 * `SecurityContext.URL`, this test fails and tells us the binding needs revisiting — instead
 * of images silently breaking in production.
 *
 * 🛑 The other half of the original claim — "and still blocks `javascript:`" — was TRUE but
 * beside the point, and asserting only it made this file look safer than it was. Angular's URL
 * check (v21) is `/^(?!javascript:)…/i`: a denylist of ONE scheme. The tests below pin that
 * measured behaviour honestly — `data:text/html` and `vbscript:` come back from Angular
 * completely unchanged — and pin `sanitizeMediaUrl`, the app's scheme ALLOWLIST, as the thing
 * that actually refuses them before they reach the binding.
 */
import { SecurityContext } from '@angular/core';
import { DomSanitizer, ɵDomSanitizerImpl as DomSanitizerImpl } from '@angular/platform-browser';
import { isAllowedUrl, sanitizeMediaUrl } from '../../editor/read-only/safe-url.util';

describe('preview media URL sanitization', () => {
	// Constructed directly: `TestBed` is unusable in this package (see the note in
	// `editor/read-only/markdown-render.util.spec.ts`). This is the real sanitizer class.
	const sanitizer: DomSanitizer = new DomSanitizerImpl(document);

	const asUrl = (value: string): string | null => sanitizer.sanitize(SecurityContext.URL, value);

	it('passes a blob: object URL through unchanged, so no bypass is needed', () => {
		const objectUrl = 'blob:http://localhost/2b6f0cc9-04ba-4f2a-9f1e-2f2b0a1c1234';

		expect(asUrl(objectUrl)).toBe(objectUrl);
		expect(sanitizeMediaUrl(objectUrl)).toBe(objectUrl);
	});

	it('still neutralizes a javascript: URL in the same binding position', () => {
		// This is what the bypass was disabling. It must keep biting.
		const sanitized = asUrl('javascript:alert(1)') ?? '';

		// Angular rewrites the scheme rather than deleting it, so the check is the allowlist.
		expect(isAllowedUrl(sanitized)).toBe(false);
		expect(sanitizeMediaUrl('javascript:alert(1)')).toBeNull();
	});

	it('passes ordinary http(s) and relative URLs used elsewhere in the preview', () => {
		expect(asUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
		expect(asUrl('/api/documents/1/raw')).toBe('/api/documents/1/raw');
		expect(sanitizeMediaUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
		expect(sanitizeMediaUrl('/api/documents/1/raw')).toBe('/api/documents/1/raw');
	});

	describe('the gap Angular leaves, and the allowlist that closes it', () => {
		it.each([
			['data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
			['data:image/svg+xml,%3Csvg%20onload%3Dalert(1)%3E'],
			['vbscript:msgbox(1)'],
			['file:///etc/passwd']
		])('Angular returns %s untouched — sanitizeMediaUrl refuses it', (url) => {
			// Pinning the measured behaviour: if a future Angular starts blocking these, this
			// line fails and the comment above it stops being a lie.
			expect(asUrl(url)).toBe(url);

			expect(sanitizeMediaUrl(url)).toBeNull();
		});

		it.each([
			['JaVaScRiPt:alert(1)'],
			['   javascript:alert(1)'],
			['\tjavascript:alert(1)'],
			['\njavascript:alert(1)'],
			['jav\tascript:alert(1)'],
			['&#106;avascript:alert(1)'],
			['&#x6a;avascript:alert(1)'],
			['jav&Tab;ascript:alert(1)']
		])('refuses %s, whatever the spelling', (url) => {
			expect(sanitizeMediaUrl(url)).toBeNull();
		});

		it('refuses an absent or empty URL rather than binding one', () => {
			expect(sanitizeMediaUrl(null)).toBeNull();
			expect(sanitizeMediaUrl(undefined)).toBeNull();
			expect(sanitizeMediaUrl('')).toBeNull();
			expect(sanitizeMediaUrl('   ')).toBeNull();
		});
	});
});
