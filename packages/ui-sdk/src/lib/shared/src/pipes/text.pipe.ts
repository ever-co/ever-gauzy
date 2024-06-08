import { Pipe, PipeTransform, SecurityContext, VERSION } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
	name: 'truncate'
})
export class TruncatePipe implements PipeTransform {
	/**
	 * Transforms a string by truncating it to a specified limit. If `completeWords` is true, the truncation will
	 * occur at the last complete word before the limit. The truncated string is appended with an `ellipsis` string.
	 *
	 * @param {string} value - The string to be transformed.
	 * @param {number} [limit=25] - The maximum length of the transformed string. Defaults to 25.
	 * @param {boolean} [completeWords=false] - Whether the truncation should occur at the last complete word before the limit. Defaults to false.
	 * @param {string} [ellipsis='...'] - The string to append to the truncated string. Defaults to '...'.
	 * @return {string} The transformed string. If the input string is falsy, an empty string is returned.
	 */
	transform(value: string, limit = 25, completeWords = false, ellipsis = '...') {
		if (!value) {
			return;
		}
		if (completeWords) {
			limit = value.substring(0, limit).lastIndexOf(' ');
		}
		return value.length > limit ? value.substring(0, limit) + ellipsis : value;
	}
}
@Pipe({
	name: 'nl2br'
})
export class Nl2BrPipe implements PipeTransform {
	constructor(private readonly sanitizer: DomSanitizer) {}
	/**
	 * Transforms a string by replacing line breaks with HTML line breaks and sanitizes it if necessary.
	 *
	 * @param {string} value - The string to be transformed.
	 * @param {boolean} [sanitizeBeforehand=false] - Whether to sanitize the string beforehand. Defaults to false.
	 * @return {string} The transformed string.
	 */
	transform(value: string, sanitizeBeforehand?: boolean): string {
		if (typeof value !== 'string') {
			return value;
		}
		let result: any;
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
