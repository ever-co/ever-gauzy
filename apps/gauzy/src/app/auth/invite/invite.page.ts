import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Invite, UserRegistrationInput } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../@core/services/auth.service';
import { InviteService } from '../../@core/services/invite.service';

@Component({
	styleUrls: ['./invite.page.scss'],
	templateUrl: 'invite.page.html'
})
export class AcceptInvitePage implements OnInit, OnDestroy {
	invitation: Invite;
	loading = true;
	inviteLoadErrorMessage = '';

	constructor(
		private translate: TranslateService,
		private inviteService: InviteService,
		private route: ActivatedRoute,
		private authService: AuthService
	) {}

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
		} catch (error) {
			this.inviteLoadErrorMessage = 'This invitation is no longer valid';
		}
		this.loading = false;
	};

	submitForm = async (userRegistrationInput: UserRegistrationInput) => {
		console.log('To register', userRegistrationInput);
		// const register  = await this.authService.register(userRegistrationInput).;
		// console.log("done", register);
	};

	ngOnDestroy(): void {}
}
