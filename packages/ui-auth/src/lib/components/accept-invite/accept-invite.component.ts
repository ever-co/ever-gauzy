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
	templateUrl: './accept-invite.component.html'
})
export class AcceptInviteComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public invitation: IInvite;
	public loading: boolean;
	public inviteLoadErrorMessage: string;

	constructor(
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly inviteService: InviteService,
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.queryParams
			.pipe(
				tap(({ email, token }) => this.loadInvite({ email, token })),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Validate invite by token & email
	 *
	 * @param param0
	 */
	loadInvite = async ({ email, token }: IUserEmailInput & IUserTokenInput) => {
		this.loading = true;

		try {
			this.invitation = await this.inviteService.validateInvite([], {
				email,
				token
			});
		} catch (error) {
			this.inviteLoadErrorMessage = this.getTranslation('ACCEPT_INVITE.INVITATION_NO_LONGER_VALID');
		}

		this.loading = false;
	};

	/**
	 *
	 * @param input
	 */
	submitForm = async (input: IUserRegistrationInput) => {
		try {
			const { user, password } = input;
			/**
			 * Validate email & token when accept invite
			 */
			const token = this.route.snapshot.queryParamMap.get('token');
			const email = this.route.snapshot.queryParamMap.get('email');
			/**
			 * If invite has successfully accepted, then login user automatically
			 */
			try {
				/**
				 * Accept Invite
				 */
				const auth: IAuthResponse = await this.inviteService.acceptInvite({
					user,
					password,
					token,
					email
				});
				if ('user' in auth && 'token' in auth) {
					const { user, token, refresh_token } = auth;
					this.store.userId = user.id;
					this.store.token = token;
					this.store.refresh_token = refresh_token;

					this.router.navigate(['/']);
				}
			} catch (error) {
				this.router.navigate(['/auth/login']);
			}
		} catch (error) {
			this.toastrService.danger(error, null, 'Could not create your account');
		}
	};

	ngOnDestroy(): void {}
}
