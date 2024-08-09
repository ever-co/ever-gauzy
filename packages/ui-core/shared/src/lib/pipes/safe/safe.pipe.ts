import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
	name: 'safeUrl'
})
export class SafeUrlPipe implements PipeTransform {
	constructor(private readonly sanitizer: DomSanitizer) {}
	/**
	 *
	 * @param url should be a string
	 * @returns is safe string
	 */
	transform(url: string) {
		if (url) {
			return this.sanitizer.bypassSecurityTrustResourceUrl(url);
		}
	}
}

@Pipe({
	name: 'safeHtml'
})
export class SafeHtmlPipe implements PipeTransform {
	constructor(private readonly sanitizer: DomSanitizer) {}

	/**
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
