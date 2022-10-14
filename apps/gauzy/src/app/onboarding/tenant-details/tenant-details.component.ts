import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IOrganizationCreateInput, IUser } from '@gauzy/contracts';
import {
	AuthService,
	OrganizationsService,
	Store,
	TenantService,
	UsersService
} from '../../@core/services';

@Component({
	selector: 'ga-tenant-details',
	templateUrl: './tenant-details.component.html',
	styleUrls: ['./tenant-details.component.scss']
})
export class TenantDetailsComponent implements OnInit, OnDestroy {
	isLoading = true;
	user: IUser;

	constructor(
		private readonly router: Router,
		private readonly organizationsService: OrganizationsService,
		private readonly tenantService: TenantService,
		private readonly usersService: UsersService,
		private readonly store: Store,
		private readonly authService: AuthService
	) {}

	ngOnInit() {
		this.isOnboardingRequired();
	}

	async isOnboardingRequired() {
		this.user = await this.usersService.getMe();
		if (this.user.tenantId) {
			this.router.navigate(['/']);
		} else {
			this.store.user = this.user;
			this.isLoading = false;
		}
	}

	async onboardUser(organization: IOrganizationCreateInput) {
		try {
			const tenant = await this.tenantService.create({ name: organization.name });
			this.user = await this.usersService.getMe(['tenant']);
			this.store.user = this.user;
			try {
				await this.organizationsService.create({
					...organization,
					tenant,
					isDefault: true
				});

				await this.registerEmployeeFeature();
				await this.getAccessTokenFromRefreshToken();

				this.router.navigate(['/onboarding/complete']);
			} catch (error) {
				console.log('Error while creating organization');
			}
		} catch (error) {
			console.log('Error while creating tenant');
		}
	}

	/**
	 * Register user as a employee on initial onboarding
	 */
	async registerEmployeeFeature() {}

	/**
	 * Get new generated access token using refresh token
	 */
	async getAccessTokenFromRefreshToken() {
		try {
			if (this.store.refresh_token) {
				const { token } = await this.authService.refreshToken(this.store.refresh_token);
				if (token) {
					this.store.token  = token;
				}
			}
		} catch (error) {
			console.log('Error while retrieving refresh token', error);
		}
	}

	ngOnDestroy() {}
}
