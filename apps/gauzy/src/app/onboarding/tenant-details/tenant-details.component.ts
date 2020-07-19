import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OrganizationCreateInput } from '@gauzy/models';
import { User } from '@sentry/browser';
import { UsersService } from '../../@core/services/users.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { TenantService } from '../../@core/services/tenant.service';

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
		private usersService: UsersService
	) {}

	ngOnInit() {
		this.isOnboardingRequired();
	}

	async isOnboardingRequired() {
		this.user = await this.usersService.getMe();
		if (this.user.tenantId) {
			this.router.navigate(['/']);
		} else {
			this.isLoading = false;
		}
	}

	async onboardUser(formData: OrganizationCreateInput) {
		const tenant = await this.tenantService.create({ name: formData.name });
		await this.organizationsService.create({ ...formData, tenant });
		this.router.navigate(['/onboarding/complete']);
	}

	ngOnDestroy() {}
}
