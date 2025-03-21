import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { NbRequestPasswordComponent } from '@nebular/auth';
import { Router } from '@angular/router';
import { NbAuthService, NB_AUTH_OPTIONS } from '@nebular/auth';
import { Observable, map } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AppService } from '@gauzy/ui-core/core';
import { IAppConfig } from '@gauzy/contracts';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-forgot-password',
	templateUrl: './forgot-password.component.html',
	styleUrls: ['./forgot-password.component.scss']
})
export class NgxForgotPasswordComponent extends NbRequestPasswordComponent implements OnInit {

	public allowEmailPasswordLogin$: Observable<boolean>;

	constructor(
		public readonly nbAuthService: NbAuthService,
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		private readonly appService: AppService,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		// Load the configuration to check if the email/password login is enabled.
		this.allowEmailPasswordLogin$ = this.appService.getAppConfigs().pipe(
			map((configs: IAppConfig) => configs.email_password_login),
			untilDestroyed(this)
		);

		// If the email/password login is not enabled, navigate to the login page.
		this.allowEmailPasswordLogin$.subscribe((allowEmailPasswordLogin: boolean) => {
			if (!allowEmailPasswordLogin) {
				this.router.navigate(['/auth/login']);
			}
		});
	}
}
