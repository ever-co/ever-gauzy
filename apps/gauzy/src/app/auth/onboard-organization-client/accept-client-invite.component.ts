import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Invite, IOrganizationContactRegistrationInput } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { InviteService } from '../../@core/services/invite.service';
import { SetLanguageBaseComponent } from '../../@shared/language-base/set-language-base.component';

@Component({
	styleUrls: ['accept-client-invite.component.scss'],
	templateUrl: 'accept-client-invite.component.html'
})
export class AcceptClientInvitePage extends SetLanguageBaseComponent
	implements OnInit {
	invitation: Invite;
	loading = true;
	inviteLoadErrorMessage = '';

	constructor(
		private readonly router: Router,
		private route: ActivatedRoute,
		private toastrService: NbToastrService,
		private translate: TranslateService,
		private inviteService: InviteService
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.route.queryParams.subscribe(async ({ email, token }) => {
			this.loadInvite(email, token);
		});
	}

	loadInvite = async (email: string, token: string) => {
		try {
			this.invitation = await this.inviteService.validateInvite(
				['organization'],
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

	submitForm = async (
		contactRegistrationInput: IOrganizationContactRegistrationInput
	) => {
		try {
			await this.inviteService.acceptOrganizationContactInvite({
				...contactRegistrationInput,
				inviteId: this.invitation.id
			});
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.ADD_NEW_ORGANIZATION',
					{
						name: contactRegistrationInput.contactOrganization.name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.router.navigate(['/auth/login']);
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	};
}
