import { Directive, ElementRef, Input, OnInit, Renderer2 } from '@angular/core';

/**
 * Renders a full HTML document (a rendered email) inside an `<iframe>` without turning
 * off Angular's sanitizer.
 *
 * Binding `[srcdoc]` would need `bypassSecurityTrustHtml`, and Angular's sanitizer would
 * otherwise strip the email's `<head>` / `<style>` blocks that the layout depends on.
 * Instead the frame is locked down first — an empty `sandbox` gives it an opaque origin
 * with scripts, forms, popups and top navigation all disabled — and only then receives
 * the document, so nothing in it can run or reach the page.
 */
@Directive({
	selector: 'iframe[gaSandboxedSrcdoc]',
	standalone: false
})
export class SandboxedSrcdocDirective implements OnInit {
	@Input('gaSandboxedSrcdoc') set document(html: string | null) {
		this.html = html ?? '';
		if (this.sandboxed) {
			this.render();
		}
	}

	private html = '';
	private sandboxed = false;

	constructor(private readonly elementRef: ElementRef<HTMLIFrameElement>, private readonly renderer: Renderer2) {}

	ngOnInit() {
		this.renderer.setAttribute(this.elementRef.nativeElement, 'sandbox', '');
		this.sandboxed = true;
		this.render();
	}

	private render() {
		this.renderer.setProperty(this.elementRef.nativeElement, 'srcdoc', this.html);
	}
}
