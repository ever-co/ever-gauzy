import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

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
	transform(value: string) {
		if (value) {
			return this.sanitizer.bypassSecurityTrustHtml(value);
		}
	}
}
