import { Component, Inject, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { UntilDestroy } from '@ngneat/until-destroy';
import { GAUZY_ENV } from '../../constants';
import { ElectronService } from '../../electron/services';
import { LanguageElectronService } from '../../language/language-electron.service';
@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-about',
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.scss'],
    standalone: false
})
export class AboutComponent implements OnInit {
	private _application = {
		name: 'gauzy-dev',
		version: 'dev',
		iconPath: null,
		companyName: 'Ever Co. LTD.'
	};
	constructor(
		private readonly _electronService: ElectronService,
		private readonly _languageElectronService: LanguageElectronService,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _domSanitizer: DomSanitizer
	) {}

	ngOnInit(): void {
		this._languageElectronService.initialize<void>();
	}

	public async openLink(link: string) {
		switch (link) {
			case 'EVER':
				await this._electronService.shell.openExternal(this._environment.COMPANY_LINK);
				break;
			case 'TOS':
				await this._electronService.shell.openExternal(this._environment.PLATFORM_TOS_URL);
				break;
			case 'PRIVACY':
				await this._electronService.shell.openExternal(this._environment.PLATFORM_PRIVACY_URL);
				break;
			default:
				break;
		}
	}

	public get application() {
		this._application = {
			name: this._electronService.remote.app
				.getName()
				.split('-')
				.join(' ')
				.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase()),
			version: this._electronService.remote.app.getVersion(),
			iconPath: this._domSanitizer.bypassSecurityTrustResourceUrl(this._environment.GAUZY_DESKTOP_LOGO_512X512),
			companyName: this._environment.COMPANY_NAME
		};
		return this._application;
	}
}
