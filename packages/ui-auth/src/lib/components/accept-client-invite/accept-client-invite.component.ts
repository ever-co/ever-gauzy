import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IInvite, IOrganizationContactRegistrationInput } from '@gauzy/contracts';
import { ErrorHandlingService, InviteService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
	selector: 'ga-accept-client-invite',
	styleUrls: ['./accept-client-invite.component.scss'],
	templateUrl: './accept-client-invite.component.html'
})
export class AcceptClientInviteComponent extends TranslationBaseComponent implements OnInit {
	public invitation: IInvite;
	public loading = true;
	public inviteLoadErrorMessage = '';

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly toastrService: ToastrService,
		public readonly translate: TranslateService,
		private readonly inviteService: InviteService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.route.queryParams.subscribe(async ({ email, token }) => {
			this.loadInvite(email, token);
		});
	}

	/**
	 * Load the invitation
	 *
	 * @param email
	 * @param token
	 */
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

	/**
	 * Accept the client invite
	 *
	 * @param input
	 * @returns void
	 */
	submitForm = async (input: IOrganizationContactRegistrationInput) => {
		try {
			// Extract the name of the organization
			const name = input.contactOrganization.name;

			// Accept the client invite
			await this.inviteService.acceptOrganizationContactInvite({
				...input,
				inviteId: this.invitation.id
			});

			// Display a success toast message
			this.toastrService.success('NOTES.ORGANIZATIONS.ADD_NEW_ORGANIZATION', { name });

			// Navigate to the login page
			this.router.navigate(['/auth/login']);
		} catch (error) {
			console.log('Error while accepting client invite', error);
			this._errorHandlingService.handleError(error);
		}
	};
}
