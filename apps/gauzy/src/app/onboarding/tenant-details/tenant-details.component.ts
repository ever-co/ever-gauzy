import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IOrganizationCreateInput, ITenant } from '@gauzy/contracts';
import { User } from '@sentry/browser';
import { UsersService } from '../../@core/services/users.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { TenantService } from '../../@core/services/tenant.service';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ga-tenant-details',
	templateUrl: './tenant-details.component.html',
	styleUrls: ['./tenant-details.component.scss']
})
export class TenantDetailsComponent implements OnInit, OnDestroy {
	isLoading = true;
	user: User = {};

	constructor(
		private router: Router,
		private organizationsService: OrganizationsService,
		private tenantService: TenantService,
		private usersService: UsersService,
		private readonly store: Store
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
						this.router.navigate(['/onboarding/complete']);
					})
					.catch((error) => {});
			})
			.catch((error) => {});
	}

	ngOnDestroy() {}
}
