import { inject, Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
	name: 'safeHtml',
	standalone: true
})
export class SafeHtmlPipe implements PipeTransform {
	private readonly sanitizer = inject(DomSanitizer);

	/**
	 * Transforms a value into a sanitized SafeHtml object.
	 *
	 * @param value - The value to be transformed.
	 * @returns A sanitized SafeHtml object if the value is a string, otherwise undefined.
	 */
	transform(value: unknown): SafeHtml | undefined {
		if (value && typeof value === 'string') {
			const sanitizedContent = this.sanitizer.sanitize(SecurityContext.HTML, value);
			if (sanitizedContent) {
				return this.sanitizer.bypassSecurityTrustHtml(sanitizedContent);
			}
		}
		return undefined;
	}
}
