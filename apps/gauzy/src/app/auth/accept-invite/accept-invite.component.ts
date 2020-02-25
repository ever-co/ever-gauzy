import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Invite, RolesEnum, UserRegistrationInput } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { InviteService } from '../../@core/services/invite.service';
import { TranslateService } from '@ngx-translate/core';
import { SetLanguageBaseComponent } from '../../@shared/language-base/set-language-base.component';

@Component({
	styleUrls: ['./accept-invite.component.scss'],
	templateUrl: 'accept-invite.component.html'
})
export class AcceptInvitePage extends SetLanguageBaseComponent
	implements OnInit, OnDestroy {
	invitation: Invite;
	loading = true;
	inviteLoadErrorMessage = '';

	constructor(
		private readonly router: Router,
		private toastrService: NbToastrService,
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
			this.inviteLoadErrorMessage = 'This invitation is no longer valid';
		}
		this.loading = false;
	};

	submitForm = async (userRegistrationInput: UserRegistrationInput) => {
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

			this.toastrService.success(
				'Your account has been created, please login',
				'Success'
			);

			this.router.navigate(['/auth/login']);
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				'Could not create your account'
			);
		}
	};

	ngOnDestroy(): void {}
}
