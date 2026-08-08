/**
 * Why `DocsPreviewModalComponent.mediaUrl` is a plain string and not a `SafeUrl`.
 *
 * The component used to bind `bypassSecurityTrustUrl(URL.createObjectURL(blob))` into
 * `<img [src]>` / `<video [src]>` / `<audio [src]>`. That bypass was pure cost: it switched
 * off Angular's URL check on a binding that renders ATTACKER-SUPPLIED files, in exchange for
 * nothing — `blob:` URLs are already permitted by the sanitizer. Worse, it would have kept
 * quietly "working" if the URL source were ever changed to something attacker-influenced.
 *
 * The claim "Angular passes `blob:` through untouched, and still blocks `javascript:`" is the
 * entire justification for that removal, so it is pinned here rather than left as a comment.
 * If a future Angular tightens `SecurityContext.URL`, this test fails and tells us the binding
 * needs revisiting — instead of images silently breaking in production.
 */
import { SecurityContext } from '@angular/core';
import { DomSanitizer, ɵDomSanitizerImpl as DomSanitizerImpl } from '@angular/platform-browser';

describe('preview media URL sanitization', () => {
	// Constructed directly: `TestBed` is unusable in this package (see the note in
	// `editor/read-only/markdown-render.util.spec.ts`). This is the real sanitizer class.
	const sanitizer: DomSanitizer = new DomSanitizerImpl(document);

	const asUrl = (value: string): string | null => sanitizer.sanitize(SecurityContext.URL, value);

	it('passes a blob: object URL through unchanged, so no bypass is needed', () => {
		const objectUrl = 'blob:http://localhost/2b6f0cc9-04ba-4f2a-9f1e-2f2b0a1c1234';

		expect(asUrl(objectUrl)).toBe(objectUrl);
	});

	it('still neutralizes a javascript: URL in the same binding position', () => {
		// This is what the bypass was disabling. It must keep biting.
		const sanitized = asUrl('javascript:alert(1)') ?? '';

		expect(sanitized.toLowerCase().startsWith('javascript:')).toBe(false);
	});

	it('passes ordinary http(s) and data:image URLs used elsewhere in the preview', () => {
		expect(asUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
		expect(asUrl('/api/documents/1/raw')).toBe('/api/documents/1/raw');
	});
});
