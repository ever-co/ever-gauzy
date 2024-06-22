import { Component, Inject, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { from, tap } from 'rxjs';
import { LanguagesEnum } from '@gauzy/contracts';
import { ElectronService } from '../../electron/services';
import { LanguageSelectorService } from '../../language/language-selector.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { GAUZY_ENV } from '../../constants';
import { DomSanitizer } from '@angular/platform-browser';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-about',
	templateUrl: './about.component.html',
	styleUrls: ['./about.component.scss']
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
		private readonly _languageSelectorService: LanguageSelectorService,
		private readonly _translateService: TranslateService,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _domSanitizer: DomSanitizer
	) { }

	ngOnInit(): void {
		from(this._electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
			.pipe(
				tap((language: LanguagesEnum) => {
					this._languageSelectorService.setLanguage(
						language,
						this._translateService
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public async openLink(link: string) {
		switch (link) {
			case 'EVER':
				await this._electronService.shell.openExternal(this._environment.COMPANY_LINK);
				break;
			case 'TOS':
				await this._electronService.shell.openExternal(
					this._environment.PLATFORM_TOS_URL
				);
				break;
			case 'PRIVACY':
				await this._electronService.shell.openExternal(
					this._environment.PLATFORM_PRIVACY_URL
				);
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
				.replace(/(^\w{1})|(\s+\w{1})/g, (letter) =>
					letter.toUpperCase()
				),
			version: this._electronService.remote.app.getVersion(),
			iconPath: this._domSanitizer.bypassSecurityTrustResourceUrl(
				this._environment.I4NET_DESKTOP_LOGO_512X512
			),
			companyName: this._environment.COMPANY_NAME
		};
		return this._application;
	}
}
