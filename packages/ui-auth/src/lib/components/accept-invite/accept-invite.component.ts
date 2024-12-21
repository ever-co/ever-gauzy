import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IAuthResponse, IInvite, IUserEmailInput, IUserRegistrationInput, IUserTokenInput } from '@gauzy/contracts';
import { InviteService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
    styleUrls: ['./accept-invite.component.scss'],
    templateUrl: './accept-invite.component.html',
    standalone: false
})
export class AcceptInviteComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public invitation: IInvite;
	public loading: boolean;
	public inviteLoadErrorMessage: string;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _toastrService: ToastrService,
		private readonly _inviteService: InviteService,
		private readonly _route: ActivatedRoute,
		private readonly _store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._route.queryParams
			.pipe(
				tap(({ email, token }) => this.loadInvite({ email, token })),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets the loading state.
	 *
	 * @param isLoading - Boolean indicating whether to set the loading state to true or false.
	 */
	private setLoading(isLoading: boolean): void {
		this.loading = isLoading;
	}

	/**
	 * Validates the invite using the provided email and token.
	 * Loads the invitation details if successful, or sets an error message if not.
	 *
	 * @param param0 - Object containing the email and token for validation.
	 */
	loadInvite = async ({ email, token }: IUserEmailInput & IUserTokenInput): Promise<void> => {
		this.setLoading(true);

		try {
			this.invitation = await this._inviteService.validateInvite([], { email, token });
		} catch {
			this.inviteLoadErrorMessage = this.getTranslation('ACCEPT_INVITE.INVITATION_NO_LONGER_VALID');
		} finally {
			this.setLoading(false);
		}
	};

	/**
	 * Submit the user registration form and accept the invite if present.
	 * @param input IUserRegistrationInput - The user registration input data
	 */
	submitForm = async (input: IUserRegistrationInput): Promise<void> => {
		try {
			const { user, password } = input;

			// Get token and email from query parameters if they exist
			const token = this._route.snapshot.queryParamMap.get('token');
			const email = this._route.snapshot.queryParamMap.get('email');

			// If invite is being accepted, attempt the authentication process
			try {
				const auth: IAuthResponse = await this._inviteService.acceptInvite({
					user,
					password,
					token,
					email
				});

				// If authentication is successful, store user and token info
				if (auth?.user && auth?.token) {
					const { user, token, refresh_token } = auth;

					// Store user details and tokens in the app's state
					this._store.userId = user.id;
					this._store.token = token;
					this._store.refresh_token = refresh_token;

					// Redirect to the home page
					await this._router.navigate(['/']);
				}
			} catch (error) {
				// In case of failure, redirect to the login page
				this._router.navigate(['/auth/login']);
			}
		} catch (error) {
			// Show error message if something goes wrong during form submission
			this._toastrService.danger(error, null, 'Could not create your account');
		}
	};

	ngOnDestroy(): void {}
}
