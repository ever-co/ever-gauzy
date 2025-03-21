import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { filter, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { NB_AUTH_OPTIONS, NbAuthOptions, NbAuthService, NbRegisterComponent } from '@nebular/auth';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { patterns } from '@gauzy/ui-core/shared';
import { AppService } from '@gauzy/ui-core/core';
import { AuthError, IAppConfig } from '@gauzy/contracts';
import { NbToastrService } from '@nebular/theme';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-register',
	templateUrl: './register.component.html',
	styleUrls: ['./register.component.scss']
})
export class NgxRegisterComponent extends NbRegisterComponent implements OnInit {
	public showPassword = false;
	public showConfirmPassword = false;
	public passwordNoSpaceEdges = patterns.passwordNoSpaceEdges;
	public queryParams$: Observable<Params>; // Observable for the query params
	public allowEmailPasswordLogin$: Observable<boolean>;

	constructor(
		public readonly translate: TranslateService,
		protected readonly nbAuthService: NbAuthService,
		protected readonly cdr: ChangeDetectorRef,
		protected readonly router: Router,
		protected readonly activatedRoute: ActivatedRoute,
		private readonly toastrService: NbToastrService,
		private readonly appService: AppService,
		@Inject(NB_AUTH_OPTIONS) options: NbAuthOptions
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		/**
		 * Get the current language from the translation service and
		 * set it as the preferred language for the user.
		 */
		const currentLang = this.translate.currentLang;
		this.user.preferredLanguage = currentLang;

		// Load the configuration to check if the email/password login is enabled.
		this.allowEmailPasswordLogin$ = this.appService.getAppConfigs().pipe(
			map((configs: IAppConfig) => configs.email_password_login),
			untilDestroyed(this)
		);

		// Create an observable to listen to query parameter changes in the current route.
		this.queryParams$ = this.activatedRoute.queryParams.pipe(
			// Filter and ensure that query parameters are present.
			filter((params: Params) => !!params),

			// Tap into the observable to update the 'user.email' property with the 'email' query parameter.
			tap(({ email }: Params) => (this.user.email = email)),

			// Use 'untilDestroyed' to handle component lifecycle and avoid memory leaks.
			untilDestroyed(this)
		);

		// If the email/password login is not enabled, navigate to the login page.
		this.allowEmailPasswordLogin$.subscribe((allowEmailPasswordLogin: boolean) => {
			// Show toast error if there is an error in the query params.
			const queryParams = this.activatedRoute.snapshot.queryParams;
			if (queryParams.error === AuthError.INVALID_EMAIL_DOMAIN) {
				this.toastrService.danger(
					this.translate.instant('REGISTER_PAGE.ERRORS.INVALID_EMAIL_DOMAIN'),
					this.translate.instant('BANNERS.ERROR_TITLE'),
					{
						duration: 8000,
						destroyByClick: true,
					}
				);
			}

			if (!allowEmailPasswordLogin) {
				this.router.navigate(['/auth/login']);
			}
		});
	}
}
