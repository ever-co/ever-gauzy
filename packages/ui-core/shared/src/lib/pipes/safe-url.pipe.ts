import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
	transform(url: string | undefined): SafeResourceUrl | null {
		if (!url) {
			return null;
		}

		try {
			const parsed = new URL(url);
			// Only allow safe protocols
			if (['http:', 'https:', 'blob:'].includes(parsed.protocol)) {
				return this.sanitizer.bypassSecurityTrustResourceUrl(url);
			}
			return null;
		} catch (e) {
			// If parsing fails, it's likely a relative URL
			return this.sanitizer.bypassSecurityTrustResourceUrl(url);
		}
	}
}
