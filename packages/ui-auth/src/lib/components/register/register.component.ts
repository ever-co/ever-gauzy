import { ChangeDetectorRef, Component, Inject, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { catchError, filter, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { NB_AUTH_OPTIONS, NbAuthOptions, NbAuthResult, NbAuthService, NbRegisterComponent } from '@nebular/auth';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { patterns } from '@gauzy/constants';
import { ITermsAcceptanceDocument } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { AuthService, readRegisterError, isCheckoutSessionId, rememberCheckoutSession } from '@gauzy/ui-core/core';

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

	/**
	 * Where to buy a subscription, when the API refused the sign-up for want of one (403 from the
	 * subscription gate). Shown as a button under the API's own message; null otherwise.
	 */
	public checkoutUrl: string | null = null;

	private readonly http = inject(HttpClient);

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

			/**
			 * Carry what the checkout already collected into the form.
			 *
			 * Both values arrive from Stripe by way of ever.co/checkout/complete, which reads them off
			 * the completed Checkout Session. The email is the address the subscription was created
			 * against, and the template hides its input entirely when the parameter is present - which
			 * is why assigning it only when it is actually there matters: an absent parameter used to
			 * write `undefined` over whatever the model already held.
			 *
			 * The name is a prefill and stays editable. Stripe collects one full name, which is the
			 * shape this form wants, but it knows nothing of the length limits configured here, so the
			 * buyer has to be able to correct it.
			 *
			 * `checkout_session` is the buyer's completed Stripe Checkout Session. It goes to the API with
			 * the registration (proof of purchase for the signup paywall) and is remembered for tenant
			 * onboarding, where the API links the new tenant to the buyer's Stripe customer after checking
			 * the session with Stripe. Anything not shaped like a session id is ignored.
			 */
			tap(({ email, name, checkout_session, ever_id, handoff }: Params) => {
				if (email) this.user.email = email;
				if (name) this.user.fullName = name;
				if (isCheckoutSessionId(checkout_session)) {
					this.user.stripeCheckoutSessionId = checkout_session;
					rememberCheckoutSession(checkout_session);
				}
				if (ever_id === '1' && typeof handoff === 'string' && handoff) {
					this.prefillFromEverId(handoff);
				}
			}),

			// Use 'untilDestroyed' to handle component lifecycle and avoid memory leaks.
			untilDestroyed(this)
		);
	}

	/**
	 * Nebular's `register()`, plus one thing it cannot do: keep the `checkoutUrl` of a refused
	 * sign-up. The strategy already turns the API's message into the error text; the URL has to be
	 * read here, from the response the result carries.
	 */
	override register(): void {
		this.errors = this.messages = [];
		this.checkoutUrl = null;
		this.submitted = true;
		this.nbAuthService
			.register(this.strategy, this.user)
			.pipe(untilDestroyed(this))
			.subscribe((result: NbAuthResult) => {
				this.submitted = false;
				if (result.isSuccess()) {
					this.messages = result.getMessages();
				} else {
					this.errors = result.getErrors();
					this.checkoutUrl = readRegisterError(result.getResponse()).checkoutUrl;
				}
				const redirect = result.getRedirect();
				if (redirect) {
					setTimeout(() => this.router.navigateByUrl(redirect), this.redirectDelay);
				}
				this.cdr.detectChanges();
			});
	}

	/**
	 * Prefills the form after an Ever ID sign-in found no Gauzy account. The verified name and e-mail
	 * are fetched with the one-time key from the URL (the URL itself carries nothing personal). When the
	 * Ever ID sign-in plugin is not enabled the request simply fails and the form stays empty.
	 *
	 * @param handoff - The one-time key.
	 */
	private prefillFromEverId(handoff: string): void {
		this.http
			.post<{ kind?: string; prefill?: { email?: string; firstName?: string; lastName?: string } }>(
				`${API_PREFIX}/auth/zitadel/handoff`,
				{ handoff }
			)
			.pipe(
				tap((record) => {
					if (record?.kind !== 'register' || !record.prefill) {
						return;
					}
					const { email, firstName, lastName } = record.prefill;
					if (email && !this.user.email) this.user.email = email;
					const fullName = [firstName, lastName].filter(Boolean).join(' ');
					if (fullName && !this.user.fullName) this.user.fullName = fullName;
					this.cdr.detectChanges();
				}),
				catchError(() => of(null)),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
