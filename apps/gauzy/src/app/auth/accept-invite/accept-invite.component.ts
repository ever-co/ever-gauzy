import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IAuthResponse, IInvite, IUserEmailInput, IUserRegistrationInput, IUserTokenInput } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { SetLanguageBaseComponent } from '@gauzy/ui-sdk/shared';
import { ToastrService } from '@gauzy/ui-sdk/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { InviteService, Store } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./accept-invite.component.scss'],
	templateUrl: 'accept-invite.component.html'
})
export class AcceptInvitePage extends SetLanguageBaseComponent implements OnInit, OnDestroy {
	invitation: IInvite;
	loading: boolean;
	inviteLoadErrorMessage: string;

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
				tap(() => (this.loading = true)),
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
		try {
			this.invitation = await this.inviteService.validateInvite([], {
				email,
				token
			});
			if (this.invitation.status) {
				throw new Error();
			}
		} catch (error) {
			this.inviteLoadErrorMessage = this.getTranslation('ACCEPT_INVITE.INVITATION_NO_LONGER_VALID');
		}
		this.loading = false;
	};

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
