import {Component, Inject, OnInit} from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from 'packages/contracts/dist';
import { from, tap } from 'rxjs';
import { ElectronService } from '../electron/services';
import { LanguageSelectorService } from '../language/language-selector.service';
import { GAUZY_ENV } from "../constants";
import {DomSanitizer} from "@angular/platform-browser";

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-splash-screen',
	templateUrl: './splash-screen.component.html',
	styleUrls: ['./splash-screen.component.scss'],
})
export class SplashScreenComponent implements OnInit {
	private _application = {
		name: 'gauzy-dev',
		version: 'dev',
		iconPath: null
	};

	constructor(
		private readonly _electronService: ElectronService,
		private readonly _languageSelectorService: LanguageSelectorService,
		private readonly _translateService: TranslateService,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _domSanitizer: DomSanitizer
	) {
		this._application = {
			name: _electronService.remote.app
				.getName()
				.split('-')
				.join(' ')
				.replace(/(^\w{1})|(\s+\w{1})/g, (letter) =>
					letter.toUpperCase()
				),
			version: _electronService.remote.app.getVersion(),
			iconPath: this._domSanitizer.bypassSecurityTrustResourceUrl(
				this._environment.PLATFORM_LOGO
			),
		};
	}

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

	public get application() {
		return this._application;
	}
}
