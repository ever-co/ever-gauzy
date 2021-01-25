import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IInvite, RolesEnum, IUserRegistrationInput } from '@gauzy/contracts';
import { InviteService } from '../../@core/services/invite.service';
import { TranslateService } from '@ngx-translate/core';
import { SetLanguageBaseComponent } from '../../@shared/language-base/set-language-base.component';
import { ToastrService } from '../../@core/services/toastr.service';

@Component({
	styleUrls: ['./accept-invite.component.scss'],
	templateUrl: 'accept-invite.component.html'
})
export class AcceptInvitePage
	extends SetLanguageBaseComponent
	implements OnInit, OnDestroy {
	invitation: IInvite;
	loading = true;
	inviteLoadErrorMessage = '';

	constructor(
		private readonly router: Router,
		private toastrService: ToastrService,
		private inviteService: InviteService,
		private route: ActivatedRoute,
		private translate: TranslateService
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.route.queryParams.subscribe(async ({ email, token }) => {
			this.loadInvite(email, token);
		});
	}

	loadInvite = async (email, token) => {
		try {
			this.invitation = await this.inviteService.validateInvite(
				['projects', 'organization', 'role'],
				{
					email,
					token
				}
			);
			this.inviteLoadErrorMessage = '';
		} catch (error) {
			this.inviteLoadErrorMessage = this.getTranslation(
				'ACCEPT_INVITE.INVITATION_NO_LONGER_VALID'
			);
		}
		this.loading = false;
	};

	submitForm = async (userRegistrationInput: IUserRegistrationInput) => {
		try {
			const { organization } = this.invitation;

			if (userRegistrationInput.user.role.name === RolesEnum.EMPLOYEE) {
				await this.inviteService.acceptEmployeeInvite({
					user: userRegistrationInput.user,
					password: userRegistrationInput.password,
					organization,
					inviteId: this.invitation.id
				});
			} else {
				await this.inviteService.acceptUserInvite({
					user: userRegistrationInput.user,
					password: userRegistrationInput.password,
					organization,
					inviteId: this.invitation.id
				});
			}

			this.toastrService.success('TOASTR.MESSAGE.PROFILE_UPDATED');

			this.router.navigate(['/auth/login']);
		} catch (error) {
			this.toastrService.danger(
				error,
				null,
				'Could not create your account'
			);
		}
	};

	ngOnDestroy(): void {}
}
