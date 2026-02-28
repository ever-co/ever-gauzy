import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
	name: 'safeUrl',
	standalone: true
})
export class SafeUrlPipe implements PipeTransform {
	private readonly sanitizer = inject(DomSanitizer);
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
