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

	it('renders an HTML message in the frame, with an empty sandbox and the document', () => {
		TestBed.configureTestingModule({ imports: [InboxEmailViewerComponent] });
		const fixture = TestBed.createComponent(InboxEmailViewerComponent);
		fixture.componentRef.setInput('html', '<p>Hi Ada</p>');
		fixture.detectChanges();
		const frame: HTMLIFrameElement = fixture.nativeElement.querySelector('[data-test="email-frame"]');
		expect(frame.getAttribute('sandbox')).toBe('');
		expect(frame.srcdoc).toContain('<p>Hi Ada</p>');

		fixture.componentRef.setInput('html', '<p>Hi Bob</p>');
		fixture.detectChanges();
		expect(frame.srcdoc).toContain('<p>Hi Bob</p>');
	});

	it('shows a plain-text message as text in the pane (no frame), its quotes and signature apart, never as markup', () => {
		TestBed.configureTestingModule({ imports: [InboxEmailViewerComponent] });
		const fixture = TestBed.createComponent(InboxEmailViewerComponent);
		fixture.componentRef.setInput('text', 'Hi <b>Ada</b>\n\n> earlier\n-- \nBob');
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		expect(el.querySelector('[data-test="email-frame"]')).toBeNull();
		const blocks = Array.from(el.querySelectorAll('.block')).map((block) => [
			block.getAttribute('data-kind'),
			block.textContent
		]);
		expect(blocks).toEqual([
			['text', 'Hi <b>Ada</b>'],
			['quote', 'earlier'],
			['signature', 'Bob']
		]);
		expect(el.querySelector('b')).toBeNull();
	});
});
