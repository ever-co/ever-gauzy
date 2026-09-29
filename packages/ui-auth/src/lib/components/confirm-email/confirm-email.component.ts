import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpStatusCode } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { ROUTES } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IConfirmEmailOutcome } from './confirm-email.resolver';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-confirm-email',
	templateUrl: './confirm-email.component.html',
	standalone: false
})
export class ConfirmEmailComponent extends TranslationBaseComponent implements OnInit {
	public loading: boolean = true;
	public errorMessage: string;
	/** The API's explanation of a refusal (e.g. "JWT token has been expired."), shown under the headline. */
	public errorDetail: string;
	public successMessage: string;
	/** Where the "continue" button goes: the dashboard for a signed-in user, the login page otherwise. */
	public continueLink: string = '/auth/login';
	public signedIn: boolean = false;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		// The link is usually opened by someone who is already signed in (registering signs you in).
		this.signedIn = !!this.store.user;
		this.continueLink = this.signedIn ? ROUTES.DASHBOARD : '/auth/login';

		this.route.data
			.pipe(
				filter((data) => !!data && !!data.resolver),
				tap(({ resolver }) => this.verifiedEmail(resolver)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Show the outcome of the confirmation.
	 *
	 * @param response - The outcome resolved by `ConfirmEmailResolver`.
	 */
	verifiedEmail(response: IConfirmEmailOutcome) {
		try {
			if (response?.status === HttpStatusCode.Ok) {
				this.successMessage = this.getTranslation('TOASTR.MESSAGE.EMAIL_VERIFICATION_VALID');
				this.markSignedInUserVerified();
			} else {
				// Any refusal, not only 400: a throttled (429) or otherwise failed request used to show
				// an empty page.
				this.errorMessage = this.getTranslation('TOASTR.MESSAGE.EMAIL_VERIFICATION_NOT_VALID');
				this.errorDetail = response?.message;
			}
		} catch (error) {
			this.errorMessage = this.getTranslation('TOASTR.MESSAGE.EMAIL_VERIFICATION_NOT_VALID');
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Tell the rest of the app the signed-in user is now verified, so the "verify your email" notice
	 * goes away without a reload. Only when the signed-in user is the one the link was for.
	 */
	private markSignedInUserVerified() {
		const user = this.store.user;
		const email = this.route.snapshot.queryParamMap.get('email');
		if (user && email && user.email?.toLowerCase() === email.toLowerCase()) {
			this.store.user = { ...user, isEmailVerified: true };
		}
	}
}
