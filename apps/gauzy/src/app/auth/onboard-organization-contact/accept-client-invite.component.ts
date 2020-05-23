import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	Invite,
	UserRegistrationInput,
	Organization,
	OrganizationCreateInput
} from '@gauzy/models';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { InviteService } from '../../@core/services/invite.service';
import { TranslateService } from '@ngx-translate/core';
import { SetLanguageBaseComponent } from '../../@shared/language-base/set-language-base.component';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { OrganizationsMutationComponent } from '../../@shared/organizations/organizations-mutation/organizations-mutation.component';
import { first } from 'rxjs/operators';

@Component({
	styleUrls: ['accept-client-invite.component.scss'],
	templateUrl: 'accept-client-invite.component.html'
})
export class AcceptClientInvitePage extends SetLanguageBaseComponent
	implements OnInit, OnDestroy {
	invitation: Invite;
	loading = true;
	signedUp = false;
	inviteLoadErrorMessage = '';

	constructor(
		private readonly router: Router,
		private route: ActivatedRoute,
		private toastrService: NbToastrService,
		private dialogService: NbDialogService,
		private translate: TranslateService,
		private inviteService: InviteService,
		private organizationsService: OrganizationsService
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

			await this.inviteService.acceptUserInvite({
				user: userRegistrationInput.user,
				password: userRegistrationInput.password,
				organization,
				inviteId: this.invitation.id
			});

			const organizationCreateInput: OrganizationCreateInput = await this.dialogService
				.open(OrganizationsMutationComponent)
				.onClose.pipe(first())
				.toPromise();

			const createdOrganization: Organization = await this.organizationsService.create(
				organizationCreateInput
			);

			console.log('link input: ', {
				organizationId: createdOrganization.id,
				inviteId: this.invitation.id
			});
			const response = await this.inviteService.linkClientOrganizationInvite(
				{
					organizationId: createdOrganization.id,
					inviteId: this.invitation.id
				}
			);

			console.log('response:', response);

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.ADD_NEW_ORGANIZATION',
					{
						name: organizationCreateInput.name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
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
