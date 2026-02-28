import { Component, Inject, OnInit, NgZone } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { UntilDestroy } from '@ngneat/until-destroy';
import { GAUZY_ENV } from '../../constants';
import { ElectronService } from '../../electron/services';
import { LanguageElectronService } from '../../language/language-electron.service';
import { NbLayoutModule, NbCardModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-about',
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.scss'],
    imports: [NbLayoutModule, NbCardModule, TranslatePipe]
})
export class AboutComponent implements OnInit {
	private _application = {
		name: 'gauzy-dev',
		version: 'dev',
		iconPath: null,
		companyName: 'Ever Co. LTD.',
		arch: ''
	};
	constructor(
		private readonly _electronService: ElectronService,
		private readonly _languageElectronService: LanguageElectronService,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _domSanitizer: DomSanitizer,
		private _ngZone: NgZone
	) { }

	ngOnInit(): void {
		this._languageElectronService.initialize<void>();
		this.getArch();
	}

	getArch() {
		this._electronService.ipcRenderer.once('get-arch', (_, arg) => {
			this._ngZone.run(() => {
				this._application.arch = arg
			});
		});
		this._electronService.ipcRenderer.send('get-arch');
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
			...this._application,
			name: this._electronService?.remote?.app
				.getName()
				.split('-')
				.join(' ')
				.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase()),
			version: this._electronService?.remote?.app?.getVersion(),
			iconPath: this._domSanitizer.bypassSecurityTrustResourceUrl(this._environment.GAUZY_DESKTOP_LOGO_512X512),
			companyName: this._environment.COMPANY_NAME
		};
		return this._application;
	}
}
