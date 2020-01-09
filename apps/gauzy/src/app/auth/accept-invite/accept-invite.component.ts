import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	Invite,
	InviteStatusEnum,
	RolesEnum,
	UserRegistrationInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';
import { EmployeesService } from '../../@core/services';
import { AuthService } from '../../@core/services/auth.service';
import { InviteService } from '../../@core/services/invite.service';
import { UsersOrganizationsService } from '../../@core/services/users-organizations.service';

@Component({
	styleUrls: ['./accept-invite.component.scss'],
	templateUrl: 'accept-invite.component.html'
})
export class AcceptInvitePage implements OnInit, OnDestroy {
	invitation: Invite;
	loading = true;
	inviteLoadErrorMessage = '';

	constructor(
		private inviteService: InviteService,
		private route: ActivatedRoute,
		private authService: AuthService,
		private employeesService: EmployeesService,
		private usersOrganizationsService: UsersOrganizationsService
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
		try {
			const registeredUser = await this.authService
				.register(userRegistrationInput)
				.pipe(first())
				.toPromise();

			const { organization } = this.invitation;

			if (userRegistrationInput.user.role.name === RolesEnum.EMPLOYEE) {
				await this.employeesService
					.create({
						user: registeredUser,
						organization
					})
					.pipe(first())
					.toPromise();
			} else {
				await this.usersOrganizationsService
					.create({
						userId: registeredUser.id,
						orgId: organization.id,
						isActive: true
					})
					.pipe(first())
					.toPromise();
			}

			this.inviteService.update(this.invitation.id, {
				status: InviteStatusEnum.ACCEPTED
			});
		} catch (error) {}
	};

	ngOnDestroy(): void {}
}
