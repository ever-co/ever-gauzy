import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { catchError, filter, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { NB_AUTH_OPTIONS, NbAuthOptions, NbAuthService, NbRegisterComponent } from '@nebular/auth';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { patterns } from '@gauzy/constants';
import { ITermsAcceptanceDocument } from '@gauzy/contracts';
import { AuthService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-register',
	templateUrl: './register.component.html',
	styleUrls: ['./register.component.scss'],
	standalone: false
})
export class NgxRegisterComponent extends NbRegisterComponent implements OnInit {
	public showPassword: boolean = false;
	public showConfirmPassword: boolean = false;
	public passwordNoSpaceEdges = patterns.passwordNoSpaceEdges;
	public queryParams$: Observable<Params>; // Observable for the query params

	/**
	 * The legal documents this signup must accept, as published by the API.
	 *
	 * Mirrored onto `user`, which is the object `NbRegisterComponent.register()`
	 * hands to `AuthStrategy.register()`, so the text the checkbox refers to and
	 * the text the acceptance record pins itself to are the same thing. The
	 * checkbox used to be bound to a bare boolean that never left the browser.
	 */
	public termsDocuments: ITermsAcceptanceDocument[] = [];

	/** True when the required documents could not be loaded — see `ngOnInit`. */
	public termsUnavailable: boolean = false;

	constructor(
		public readonly translate: TranslateService,
		protected readonly nbAuthService: NbAuthService,
		protected readonly cdr: ChangeDetectorRef,
		protected readonly router: Router,
		protected readonly activatedRoute: ActivatedRoute,
		private readonly authService: AuthService,
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

		/**
		 * Load the documents this account has to accept.
		 *
		 * If the call fails the submit button stays disabled rather than letting
		 * someone tick a box whose acceptance cannot be recorded. A registration
		 * that silently stores no acceptance is exactly the defect being fixed,
		 * so failing visibly is the better outcome.
		 */
		this.authService
			.getRequiredTermsDocuments(currentLang)
			.pipe(
				tap((documents: ITermsAcceptanceDocument[]) => {
					this.termsDocuments = documents ?? [];
					this.termsUnavailable = this.termsDocuments.length === 0;
					this.user.termsDocuments = this.termsDocuments;
					this.cdr.detectChanges();
				}),
				catchError(() => {
					this.termsUnavailable = true;
					this.cdr.detectChanges();
					return of([] as ITermsAcceptanceDocument[]);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Create an observable to listen to query parameter changes in the current route.
		this.queryParams$ = this.activatedRoute.queryParams.pipe(
			// Filter and ensure that query parameters are present.
			filter((params: Params) => !!params),

			// Tap into the observable to update the 'user.email' property with the 'email' query parameter.
			tap(({ email }: Params) => (this.user.email = email)),

			// Use 'untilDestroyed' to handle component lifecycle and avoid memory leaks.
			untilDestroyed(this)
		);
	}
}
