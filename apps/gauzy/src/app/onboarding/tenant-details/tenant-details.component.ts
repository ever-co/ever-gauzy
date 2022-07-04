import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IOrganizationCreateInput, ITenant } from '@gauzy/contracts';
import { User } from '@sentry/browser';
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
	user: User = {};

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

	async onboardUser(formData: IOrganizationCreateInput) {
		this.tenantService
			.create({ name: formData.name })
			.then(async (tenant: ITenant) => {
				this.user = await this.usersService.getMe(['tenant']);
				this.store.user = this.user;
				this.organizationsService
					.create({ ...formData, tenant, isDefault: true })
					.then(() => {
						this.getAccessTokenFromRefreshToken();
						this.router.navigate(['/onboarding/complete']);
					})
					.catch((error) => {});
			})
			.catch((error) => {});
	}

	/**
	 * Get new generated access token using refresh token
	 */
	async getAccessTokenFromRefreshToken() {
		if (this.store.refresh_token) {
			const { token } = await this.authService.refreshToken(this.store.refresh_token);
			if (token) {
				this.store.token  = token;
			}
		}
	}

	ngOnDestroy() {}
}
