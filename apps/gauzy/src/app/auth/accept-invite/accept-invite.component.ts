import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IInvite, RolesEnum, IUserRegistrationInput } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { SetLanguageBaseComponent } from '../../@shared/language-base/set-language-base.component';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { InviteService, ToastrService } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./accept-invite.component.scss'],
	templateUrl: 'accept-invite.component.html'
})
export class AcceptInvitePage
	extends SetLanguageBaseComponent
	implements OnInit, OnDestroy {

	invitation: IInvite;
	loading: boolean;
	inviteLoadErrorMessage: string;

	constructor(
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly inviteService: InviteService,
		private readonly route: ActivatedRoute,
		private translate: TranslateService
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.route
			.queryParams
			.pipe(
				tap(() => this.loading = true),
				tap(({ email, token }) => this.loadInvite(email, token)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	loadInvite = async (email: string, token: string) => {
		try {
			this.invitation = await this.inviteService.validateInvite(['role', 'organization'], {
				email,
				token
			});
			if (!this.invitation) {
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
			const { id: inviteId, role, organization } = this.invitation;
			if (role.name === RolesEnum.EMPLOYEE) {
				await this.inviteService.acceptEmployeeInvite({ 
					user,
					password,
					organization,
					inviteId
				});
			} else {
				await this.inviteService.acceptUserInvite({ 
					user,
					password,
					organization,
					inviteId
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
