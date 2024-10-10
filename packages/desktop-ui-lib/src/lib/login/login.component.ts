import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NB_AUTH_OPTIONS, NbAuthService, NbLoginComponent } from '@nebular/auth';
import { UntilDestroy } from '@ngneat/until-destroy';
import { ElectronService } from '../electron/services';
import { LanguageElectronService } from '../language/language-electron.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-desktop-timer-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss']
})
export class NgxLoginComponent extends NbLoginComponent implements OnInit {
	showPassword = false;

	constructor(
		public readonly electronService: ElectronService,
		public readonly nbAuthService: NbAuthService,
		public readonly languageElectronService: LanguageElectronService,
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		@Inject(NB_AUTH_OPTIONS)
		options: any
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		this.languageElectronService.initialize<void>();
	}

	public forgot(): void {
		this.electronService.shell.openExternal('https://app.gauzy.co/#/auth/request-password');
	}

	public register(): void {
		this.electronService.shell.openExternal('https://app.gauzy.co/#/auth/register');
	}
}
