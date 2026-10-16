import { TestBed } from '@angular/core/testing';
import {
	EMAIL_DOCUMENT_CSP,
	emailDocument,
	escapeHtml,
	InboxEmailViewerComponent
} from './inbox-email-viewer.component';

/** The email viewer: a sandboxed frame whose document blocks scripts and every fetch. */
describe('InboxEmailViewerComponent', () => {
	it('shows a text message as text, never as markup', () => {
		const doc = emailDocument(null, '<script>alert(1)</script> & "quotes"');
		expect(doc).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;');
		expect(doc).not.toContain('<script>');
		expect(escapeHtml(`'`)).toBe('&#39;');
	});

	it('puts its own Content-Security-Policy in the document: no script, no remote image, no form', () => {
		const doc = emailDocument('<p>Hello <img src="https://tracker.example.test/p.gif"></p>', null);
		expect(doc).toContain(`http-equiv="Content-Security-Policy" content="${EMAIL_DOCUMENT_CSP}"`);
		expect(EMAIL_DOCUMENT_CSP).toContain("default-src 'none'");
		expect(EMAIL_DOCUMENT_CSP).not.toMatch(/img-src[^;]*https?:/);
		expect(EMAIL_DOCUMENT_CSP).toContain("form-action 'none'");
		expect(EMAIL_DOCUMENT_CSP).not.toContain('script-src');
	});

	it('renders the frame with an empty sandbox and the document', () => {
		TestBed.configureTestingModule({ imports: [InboxEmailViewerComponent] });
		const fixture = TestBed.createComponent(InboxEmailViewerComponent);
		fixture.componentRef.setInput('text', 'Hi Ada');
		fixture.detectChanges();
		const frame: HTMLIFrameElement = fixture.nativeElement.querySelector('[data-test="email-frame"]');
		expect(frame.getAttribute('sandbox')).toBe('');
		expect(frame.srcdoc).toContain('<pre>Hi Ada</pre>');

		fixture.componentRef.setInput('text', 'Hi Bob');
		fixture.detectChanges();
		expect(frame.srcdoc).toContain('<pre>Hi Bob</pre>');
	});
});
