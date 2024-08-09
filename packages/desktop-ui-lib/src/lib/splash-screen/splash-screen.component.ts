import { Component, Inject, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { UntilDestroy } from '@ngneat/until-destroy';
import { GAUZY_ENV } from '../constants';
import { ElectronService } from '../electron/services';
import { LanguageElectronService } from '../language/language-electron.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-splash-screen',
	templateUrl: './splash-screen.component.html',
	styleUrls: ['./splash-screen.component.scss']
})
export class SplashScreenComponent implements OnInit {
	private _application = {
		name: 'gauzy-dev',
		version: 'dev',
		iconPath: null
	};

	constructor(
		private readonly _electronService: ElectronService,
		private readonly _languageElectronService: LanguageElectronService,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _domSanitizer: DomSanitizer
	) {
		this._application = {
			name: _electronService.remote.app
				.getName()
				.split('-')
				.join(' ')
				.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase()),
			version: _electronService.remote.app.getVersion(),
			iconPath: this._domSanitizer.bypassSecurityTrustResourceUrl(this._environment.PLATFORM_LOGO)
		};
	}

	ngOnInit(): void {
		this._languageElectronService.initialize<void>();
	}

	public get application() {
		return this._application;
	}
}
