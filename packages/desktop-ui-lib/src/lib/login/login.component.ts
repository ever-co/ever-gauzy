import {
	ChangeDetectorRef,
	Component,
	Inject,
	NgZone,
	OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import {
	NbAuthService,
	NbLoginComponent,
	NB_AUTH_OPTIONS,
} from '@nebular/auth';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { ElectronService } from '../electron/services';
import { LanguageSelectorService } from '../language/language-selector.service';
import { from, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-desktop-timer-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss'],
})
export class NgxLoginComponent extends NbLoginComponent implements OnInit {
	showPassword = false;

	constructor(
		public readonly electronService: ElectronService,
		public readonly nbAuthService: NbAuthService,
		public translate: TranslateService,
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		private _languageSelectorService: LanguageSelectorService,
		private _ngZone: NgZone,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		this.electronService.ipcRenderer.on(
			'preferred_language_change',
			(event, language: LanguagesEnum) => {
				this._ngZone.run(() => {
					this._languageSelectorService.setLanguage(
						language,
						this.translate
					);
				});
			}
		);
		from(this.electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
			.pipe(
				tap((language) => {
					this._languageSelectorService.setLanguage(
						language,
						this.translate
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public forgot(): void {
		this.electronService.shell.openExternal(
			'https://app.gauzy.co/#/auth/request-password'
		);
	}

	public register(): void {
		this.electronService.shell.openExternal(
			'https://app.gauzy.co/#/auth/register'
		);
	}
}
