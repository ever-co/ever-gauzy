import { Component, Inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { GAUZY_ENV } from '../../../../constants';

@Component({
    selector: 'gauzy-logo',
    templateUrl: './logo.component.html',
    styleUrls: ['./logo.component.scss'],
    standalone: false
})
export class LogoComponent {
	constructor(
		private readonly _domSanitizer: DomSanitizer,
		@Inject(GAUZY_ENV)
		private readonly _environment: any
	) {}

	public get logoUrl(): SafeResourceUrl {
		return this._domSanitizer.bypassSecurityTrustResourceUrl(this._environment.PLATFORM_LOGO);
	}
}
