import { ChangeDetectorRef, Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { FormGroupDirective } from '@angular/forms';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';
import { CookieService } from 'ngx-cookie-service';
import { Observable, filter, map } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { RolesEnum, IAppConfig, AuthError } from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { ElectronService, AppService } from '@gauzy/ui-core/core';
import { patterns } from '@gauzy/ui-core/shared';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss']
})
export class NgxLoginComponent extends NbLoginComponent implements OnInit {
	@ViewChild('form') private readonly form: FormGroupDirective;

	isShown = false;
	RolesEnum = RolesEnum;
	isDemo: boolean = environment.DEMO;
	showPassword = false;
	passwordNoSpaceEdges = patterns.passwordNoSpaceEdges;
	public allowEmailPasswordLogin$: Observable<boolean>;
	public allowEmailPasswordLogin: boolean;

	constructor(
		private readonly cookieService: CookieService,
		public readonly nbAuthService: NbAuthService,
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		private readonly activatedRoute: ActivatedRoute,
		public readonly electronService: ElectronService,
		private readonly el: ElementRef,
		private readonly appService: AppService,
		private readonly toastrService: NbToastrService,
		private readonly translate: TranslateService,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		// -- to not block the scroll after logout
		const body = this.el.nativeElement.closest('body');
		body.removeAttribute('style');
		this.checkRememberdMe();
		this.autoFillCredential();

		// Load the configuration to check if the email/password login is enabled.
		this.allowEmailPasswordLogin$ = this.appService.getAppConfigs().pipe(
			map((configs: IAppConfig) => {
				this.allowEmailPasswordLogin = configs.email_password_login;
				return configs.email_password_login;
			}),
			untilDestroyed(this)
		);

		// Create an observable to listen to query parameter changes in the current route.
		this.activatedRoute.queryParams.pipe(
			// Filter and ensure that query parameters are present.
			filter((params: Params) => !!params),
			// Use 'untilDestroyed' to handle component lifecycle and avoid memory leaks.
			untilDestroyed(this)
		).subscribe((queryParams: Params) => {
			// Check if there is an error in the query params.
			this.checkErrors(queryParams);
		});
	}

	checkErrors(params: Params) {
		if (params.error === AuthError.INVALID_EMAIL_DOMAIN) {
			this.toastrService.danger(
				this.translate.instant('REGISTER_PAGE.ERRORS.INVALID_EMAIL_DOMAIN'),
				this.translate.instant('BANNERS.ERROR_TITLE'),
				{
					duration: 8000,
					destroyByClick: true,
				}
			);
		}
	}

	/**
	 * Implemented Rememberd Me Feature
	 */
	checkRememberdMe() {
		if (this.cookieService.check('rememberMe')) {
			const { email, rememberMe } = this.cookieService.getAll();
			this.user.email = email;
			this.user.rememberMe = rememberMe;
		}
	}

	collapseDemo() {
		if (this.isDemo) {
			this.isShown = !this.isShown;
		}
	}

	/**
	 * Autofill Super Admin Credential By Default
	 */
	autoFillCredential() {
		if (this.isDemo) {
			this.user.email = environment.DEMO_SUPER_ADMIN_EMAIL;
			this.user.password = environment.DEMO_SUPER_ADMIN_PASSWORD;
		}
	}

	/**
	 * Automatic Login For Demo Server
	 *
	 * @param role
	 */
	autoLogin(role: RolesEnum) {
		if (this.isDemo) {
			switch (role) {
				case RolesEnum.SUPER_ADMIN:
					this.autoFillCredential();
					break;
				case RolesEnum.ADMIN:
					this.user.email = environment.DEMO_ADMIN_EMAIL;
					this.user.password = environment.DEMO_ADMIN_PASSWORD;
					break;
				case RolesEnum.EMPLOYEE:
					this.user.email = environment.DEMO_EMPLOYEE_EMAIL;
					this.user.password = environment.DEMO_EMPLOYEE_PASSWORD;
					break;
				default:
					break;
			}
			this.form.ngSubmit.emit();
		}
	}
}
