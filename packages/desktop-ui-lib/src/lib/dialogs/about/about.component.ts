import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { from, tap } from 'rxjs';
import { LanguagesEnum } from 'packages/contracts/dist';
import { ElectronService } from '../../electron/services';
import { LanguageSelectorService } from '../../language/language-selector.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

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
		iconPath: ''
	};
	constructor(
		private readonly _electronService: ElectronService,
		private readonly _languageSelectorService: LanguageSelectorService,
		private readonly _translateService: TranslateService
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

	public openLink(link: string) {
		switch (link) {
			case 'EVER':
				this._electronService.shell.openExternal('https://ever.co');
				break;
			case 'TOS':
				this._electronService.shell.openExternal(
					'https://gauzy.co/tos'
				);
				break;
			case 'PRIVACY':
				this._electronService.shell.openExternal(
					'https://gauzy.co/privacy'
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
			iconPath: './assets/icons/icon_512x512.png'
		};
		return this._application;
	}
}
