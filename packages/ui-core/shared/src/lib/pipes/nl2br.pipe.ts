import { inject, Pipe, PipeTransform, SecurityContext, VERSION } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
	name: 'nl2br',
	standalone: true
})
export class Nl2BrPipe implements PipeTransform {
	private readonly sanitizer = inject(DomSanitizer);

	/**
	 * Transforms a string by replacing line breaks with HTML line breaks and sanitizes it if necessary.
	 *
	 * @param {string} value - The string to be transformed.
	 * @param {boolean} [sanitizeBeforehand=false] - Whether to sanitize the string beforehand. Defaults to false.
	 * @return {string | SafeHtml | null} The transformed string.
	 */
	transform(value: string, sanitizeBeforehand?: boolean): string | SafeHtml | null {
		if (typeof value !== 'string') {
			return value;
		}

		let result: string | SafeHtml | null;
		const textParsed = value.replace(/(?:\r\n|\r|\n)/g, '<br />');

		if (!VERSION || VERSION.major === '2') {
			result = this.sanitizer.bypassSecurityTrustHtml(textParsed);
		} else if (sanitizeBeforehand) {
			result = this.sanitizer.sanitize(SecurityContext.HTML, textParsed);
		} else {
			result = textParsed;
		}

		return result;
	}
}
