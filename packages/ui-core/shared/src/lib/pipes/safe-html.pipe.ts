import { inject, Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
	name: 'safeHtml',
	standalone: true
})
export class SafeHtmlPipe implements PipeTransform {
	private readonly sanitizer = inject(DomSanitizer);

	/**
	 *
	 * @param value should be a string
	 * @returns is safe string
	 */
	transform(value: string): SafeHtml | null {
		if (value) {
			const sanitizedContent = this.sanitizer.sanitize(SecurityContext.HTML, value);
			if (sanitizedContent) {
				return this.sanitizer.bypassSecurityTrustHtml(sanitizedContent);
			}
		}
		return null;
	}
}
