import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { filter, firstValueFrom, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization, IOrganizationCreateInput, IUser } from '@gauzy/contracts';
import {
	AuthService,
	EmployeesService,
	ErrorHandlingService,
	OrganizationsService,
	Store,
	TenantService,
	UsersService
} from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ga-tenant-onboarding',
	templateUrl: './tenant-onboarding.component.html',
	styleUrls: ['./tenant-onboarding.component.scss']
})
export class TenantOnboardingComponent implements OnInit, OnDestroy {
	public loading: boolean = true;
	public user: IUser;

	constructor(
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _organizationsService: OrganizationsService,
		private readonly _tenantService: TenantService,
		private readonly _usersService: UsersService,
		private readonly _store: Store,
		private readonly _authService: AuthService,
		private readonly _employeesService: EmployeesService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	ngOnInit() {
		this._activatedRoute.data
			.pipe(
				filter(({ user }: Data) => !!user),
				tap(({ user }: Data) => (this._store.user = user)),
				tap(() => (this.loading = false)),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Onboard a user by creating a tenant, fetching the user details, and setting up the organization.
	 *
	 * @param {IOrganizationCreateInput} organization - The organization input data required for onboarding.
	 */
	async onboardUser(organization: IOrganizationCreateInput): Promise<void> {
		this.loading = true;

		try {
			const tenant = await this._tenantService.create({ name: organization.name });
			this.user = await this._usersService.getMe(['tenant']);
			this._store.user = this.user;

			try {
				const createdOrganization = await this._organizationsService.create({
					...organization,
					tenant,
					isDefault: true
				});

				await this.getAccessTokenFromRefreshToken();
				this.registerEmployeeFeature(organization, createdOrganization); // Process in the background

				this._router.navigate(['/onboarding/complete']);
			} catch (error) {
				console.error('Error while creating organization:', error);
			}
		} catch (error) {
			console.error('Error while creating tenant:', error);
			// Handle and log errors using the _errorHandlingService
			this._errorHandlingService.handleError(error);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Registers the user as an employee during the initial onboarding process.
	 *
	 * @param {IOrganizationCreateInput} organization - The organization input data required for registration.
	 * @param {IOrganization} createdOrganization - The created organization entity.
	 */
	async registerEmployeeFeature(
		organization: IOrganizationCreateInput,
		createdOrganization: IOrganization
	): Promise<void> {
		if (!createdOrganization || !this.user) {
			return;
		}

		if (organization.registerAsEmployee) {
			const { id: organizationId } = createdOrganization;
			const { id: userId, tenantId } = this.user;

			try {
				await firstValueFrom(
					this._employeesService.create({
						startedWorkOn: organization.startedWorkOn ? new Date(organization.startedWorkOn) : null,
						userId,
						organizationId,
						tenantId
					})
				);
			} catch (error) {
				console.error('Error while registering employee:', error);
			}
		}
	}

	/**
	 * Get new access token using refresh token stored in _store
	 */
	async getAccessTokenFromRefreshToken() {
		try {
			const { refresh_token } = this._store;
			if (refresh_token) {
				const { token } = await this._authService.refreshToken(refresh_token);
				if (token) {
					this._store.token = token;
				}
			}
		} catch (error) {
			console.error('Error while retrieving refresh token', error);
		}
	}

	ngOnDestroy() {}
}
