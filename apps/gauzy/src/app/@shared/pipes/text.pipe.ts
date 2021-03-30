import { Pipe, PipeTransform, SecurityContext, VERSION } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
	name: 'truncate'
})
export class TruncatePipe implements PipeTransform {
	transform(
		value: string,
		limit = 25,
		completeWords = false,
		ellipsis = '...'
	) {
		if (completeWords) {
			limit = value.substr(0, limit).lastIndexOf(' ');
		}
		return value.length > limit ? value.substr(0, limit) + ellipsis : value;
	}
}

@Pipe({ name: 'safeHtml' })
export class SafeHtmlPipe implements PipeTransform {
	constructor(private sanitized: DomSanitizer) {}
	transform(value) {
		return this.sanitized.bypassSecurityTrustHtml(value);
	}
}

@Pipe({
	name: 'nl2br'
})
export class Nl2BrPipe implements PipeTransform {
	constructor(private sanitizer: DomSanitizer) {}

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
