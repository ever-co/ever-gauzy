import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
	NbAuthService,
	NbLoginComponent,
	NB_AUTH_OPTIONS,
} from '@nebular/auth';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { ElectronService } from '../electron/services';

@Component({
	selector: 'ngx-desktop-timer-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss'],
})
export class NgxLoginComponent extends NbLoginComponent implements OnInit {
	showPassword: boolean = false;

	constructor(
		public readonly electronService: ElectronService,
		public readonly nbAuthService: NbAuthService,
		public translate: TranslateService,
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
		// this language will be used as a fallback when a translation isn't found in the current language
		translate.setDefaultLang(LanguagesEnum.ENGLISH);
		// the lang to use, if the lang isn't available, it will use the current loader to get them
		translate.use(LanguagesEnum.ENGLISH);
	}

	ngOnInit() { }

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
