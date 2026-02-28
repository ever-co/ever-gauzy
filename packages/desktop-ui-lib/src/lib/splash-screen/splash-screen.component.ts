import { Component, Inject, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { UntilDestroy } from '@ngneat/until-destroy';
import { GAUZY_ENV } from '../constants';
import { ElectronService } from '../electron/services';
import { LanguageElectronService } from '../language/language-electron.service';
import { NbLayoutModule, NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { SpinnerButtonDirective } from '../directives/spinner-button.directive';
import { TranslatePipe } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-splash-screen',
    templateUrl: './splash-screen.component.html',
    styleUrls: ['./splash-screen.component.scss'],
    imports: [NbLayoutModule, NbCardModule, NbButtonModule, SpinnerButtonDirective, NbIconModule, TranslatePipe]
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
