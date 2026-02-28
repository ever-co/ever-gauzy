import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
	name: 'safeHtml',
	standalone: true
})
export class SafeHtmlPipe implements PipeTransform {
	private readonly sanitizer = inject(DomSanitizer);

	/**
	 * Transforms a string into SafeHtml, bypassing Angular's security trust for HTML.
	 *
	 * @warning This pipe disables Angular's built-in sanitization. Ensure that the `value` is trusted HTML.
	 * Using this with untrusted user input can lead to XSS vulnerabilities.
	 *
	 * @param value should be a string
	 * @returns is safe string
	 */
	transform(value: string) {
		if (value) {
			return this.sanitizer.bypassSecurityTrustHtml(value);
		}
	}
}
