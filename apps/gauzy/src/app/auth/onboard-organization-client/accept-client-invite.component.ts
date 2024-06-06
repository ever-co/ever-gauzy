import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IInvite, IOrganizationContactRegistrationInput } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { SetLanguageBaseComponent } from '@gauzy/ui-sdk/i18n';
import { InviteService, ToastrService } from '@gauzy/ui-sdk/core';

@Component({
	styleUrls: ['accept-client-invite.component.scss'],
	templateUrl: 'accept-client-invite.component.html'
})
export class AcceptClientInvitePage extends SetLanguageBaseComponent implements OnInit {
	invitation: IInvite;
	loading = true;
	inviteLoadErrorMessage = '';

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly toastrService: ToastrService,
		public readonly translate: TranslateService,
		private readonly inviteService: InviteService
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
			this.invitation = await this.inviteService.validateInvite(['organization'], {
				email,
				token
			});
			this.inviteLoadErrorMessage = '';
		} catch (error) {
			this.inviteLoadErrorMessage = this.getTranslation('ACCEPT_INVITE.INVITATION_NO_LONGER_VALID');
		}
		this.loading = false;
	};

	submitForm = async (contactRegistrationInput: IOrganizationContactRegistrationInput) => {
		try {
			await this.inviteService.acceptOrganizationContactInvite({
				...contactRegistrationInput,
				inviteId: this.invitation.id
			});
			this.toastrService.success('NOTES.ORGANIZATIONS.ADD_NEW_ORGANIZATION', {
				name: contactRegistrationInput.contactOrganization.name
			});

			this.router.navigate(['/auth/login']);
		} catch (error) {
			this.toastrService.danger(error);
		}
	};
}
