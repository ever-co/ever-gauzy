import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { NbMenuItem } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { merge, pairwise } from 'rxjs';
import { filter, map, take, tap } from 'rxjs/operators';
import { NgxPermissionsService } from 'ngx-permissions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { chain } from 'underscore';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	AuthStrategy,
	IJobMatchingEntity,
	IntegrationEntitySettingServiceStoreService,
	IntegrationsService,
	NavMenuBuilderService,
	NavMenuSectionItem,
	PermissionsService,
	Store,
	UsersService
} from '@gauzy/ui-core/core';
import { FeatureEnum, IOrganization, IRolePermission, IUser, IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/ui-core/common';
import { ReportService } from './reports/all-report/report.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-pages',
	styleUrls: ['pages.component.scss'],
	template: `
		<ngx-one-column-layout *ngIf="!!menu && user">
			<ga-main-nav-menu></ga-main-nav-menu>
			<router-outlet></router-outlet>
		</ngx-one-column-layout>
	`
})
export class PagesComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public organization: IOrganization;
	public user: IUser;
	public menu: NbMenuItem[] = [];
	public reportMenuItems: NavMenuSectionItem[] = [];

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		public readonly translate: TranslateService,
		private readonly store: Store,
		private readonly reportService: ReportService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly usersService: UsersService,
		private readonly authStrategy: AuthStrategy,
		private readonly _integrationsService: IntegrationsService,
		private readonly _integrationEntitySettingServiceStoreService: IntegrationEntitySettingServiceStoreService,
		private readonly _navMenuBuilderService: NavMenuBuilderService,
		private readonly _permissionsService: PermissionsService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.route.data
			.pipe(
				filter(({ user }: Data) => !!user),
				tap(({ user }: Data) => {
					//When a new user registers & logs in for the first time, he/she does not have tenantId.
					//In this case, we have to redirect the user to the onboarding page to create their first organization, tenant, role.
					if (!user.tenantId) {
						this.router.navigate(['/onboarding/tenant']);
						return;
					}
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
		await this._createEntryPoint();

		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				pairwise(), // Pair each emitted value with the previous one
				tap(([organization]: [IOrganization, IOrganization]) => {
					const { id: organizationId, tenantId } = organization;

					// Remove the specified menu items for previous selected organization
					this._navMenuBuilderService.removeNavMenuItems(
						// Define the base item IDs
						this.getReportMenuBaseItemIds().map((itemId) => `${itemId}-${organizationId}-${tenantId}`),
						'reports'
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getReportsMenus()),
				tap(() => this.getIntegrationEntitySettings()),
				untilDestroyed(this)
			)
			.subscribe();

		this.store.userRolePermissions$
			.pipe(
				filter((permissions: IRolePermission[]) => isNotEmpty(permissions)),
				map((permissions) => permissions.map(({ permission }) => permission)),
				tap((permissions) => {
					this.ngxPermissionsService.flushPermissions();
					this.ngxPermissionsService.loadPermissions(permissions);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.reportService.menuItems$.pipe(distinctUntilChange(), untilDestroyed(this)).subscribe((menuItems) => {
			if (menuItems) {
				this.reportMenuItems = chain(menuItems)
					.values()
					.map((item) => {
						return {
							id: item.slug + `-${this.organization?.id}`,
							title: item.name,
							link: `/pages/reports/${item.slug}`,
							icon: item.iconClass,
							data: {
								translationKey: `${item.name}`
							}
						};
					})
					.value();
			} else {
				this.reportMenuItems = [];
			}
			this.addOrganizationReportsMenuItems();
		});
	}

	/**
	 * Executes after the view initialization.
	 */
	ngAfterViewInit(): void {
		// Merge observables to handle changes in job matching entity settings
		const merge$ = merge(
			this._integrationEntitySettingServiceStoreService.jobMatchingEntity$.pipe(
				distinctUntilChange(), // Ensure that only distinct changes are considered
				filter(({ currentValue }: IJobMatchingEntity) => !!currentValue), // Filter out falsy values
				tap(({ currentValue }: IJobMatchingEntity) => {
					// Update component properties based on the current job matching entity settings
					const isEmployeeJobMatchingEntity = !!currentValue.sync && !!currentValue.isActive;

					// Add or remove the jobs navigation menu items based on the current job matching entity
					isEmployeeJobMatchingEntity
						? this.addJobsNavigationMenuItems()
						: this.removeJobsNavigationMenuItems();
				})
			),
			this.store.user$.pipe(
				take(1),
				distinctUntilChange(),
				filter((user: IUser) => !!user && !!user.employee?.id),
				tap(() => this.addTasksNavigationMenuItems())
			),
			this.store.selectedOrganization$.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.addOrganizationManageMenuItem(organization))
			)
		);
		// Subscribe to the merge$ observable
		merge$.pipe(untilDestroyed(this)).subscribe();
	}

	/**
	 * Adds report menu items to the organization's navigation menu.
	 */
	private addOrganizationReportsMenuItems() {
		if (!this.organization) {
			// Handle the case where this.organization is not defined
			console.warn('Organization not defined. Unable to add/remove menu items.');
			return;
		}
		const { id: organizationId, tenantId } = this.organization;

		// Remove the specified menu items for current selected organization
		// Note: We need to remove old menus before constructing new menus for the organization.
		this._navMenuBuilderService.removeNavMenuItems(
			// Define the base item IDs
			this.getReportMenuBaseItemIds().map((itemId) => `${itemId}-${organizationId}-${tenantId}`),
			'reports'
		);

		// Validate if reportMenuItems is an array and has elements
		if (!Array.isArray(this.reportMenuItems) || this.reportMenuItems.length === 0) {
			return;
		}

		// Iterate over each report and add it to the navigation menu
		try {
			this.reportMenuItems.forEach((report: NavMenuSectionItem) => {
				// Validate the structure of each report item
				if (report && report.id && report.title) {
					this._navMenuBuilderService.addNavMenuItem(
						{
							id: report.id, // Unique identifier for the menu item
							title: report.title, // The title of the menu item
							icon: report.icon, // The icon class for the menu item, using FontAwesome in this case
							link: report.link, // The link where the menu item directs
							data: report.data
						},
						'reports'
					); // The id of the section where this item should be added
				}
			});
		} catch (error) {
			console.error('Error adding report menu items', error);
		}
	}

	/**
	 * Retrieves the base item IDs for the report menu.
	 * These IDs represent the default menu items that are available in the report menu.
	 * @returns An array containing the base item IDs.
	 */
	public getReportMenuBaseItemIds() {
		// Define the base item IDs
		return [
			'amounts-owed', // Outstanding amounts
			'apps-urls', // Applications and URLs
			'client-budgets', // Budgets per client
			'daily-limits', // Daily spending limits
			'expense', // Expense reports
			'manual-time-edits', // Edits in time logs
			'payments', // Payment transactions
			'project-budgets', // Budgets per project
			'time-activity', // Time-based activities
			'weekly', // Weekly summaries
			'weekly-limits' // Weekly spending limits
		];
	}

	/**
	 * Adds navigation menu item for managing organization.
	 */
	private addOrganizationManageMenuItem(organization: IOrganization): void {
		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'organization-manage', // Unique identifier for the menu item
				title: 'Manage', // The title of the menu item
				icon: 'fas fa-globe-americas', // The icon class for the menu item, using FontAwesome in this case
				link: `/pages/organizations/edit/${organization?.id}`, // The link where the menu item directs
				pathMatch: 'prefix',
				data: {
					translationKey: 'MENU.MANAGE',
					permissionKeys: [PermissionsEnum.ALL_ORG_EDIT], // Key for translation (i18n)
					featureKey: FeatureEnum.FEATURE_ORGANIZATION //
				}
			},
			'organization',
			'organization-equipment'
		); // The id of the section where this item should be added
	}

	/**
	 * Adds navigation menu items for tasks.
	 */
	private addTasksNavigationMenuItems(): void {
		this._navMenuBuilderService.addNavMenuItem(
			{
				id: 'tasks-my-tasks', // Unique identifier for the menu item
				title: 'My Tasks', // The title of the menu item
				icon: 'fas fa-user', // The icon class for the menu item, using FontAwesome in this case
				link: '/pages/tasks/me', // The link where the menu item directs
				data: {
					translationKey: 'MENU.MY_TASKS', // Key for translation (i18n)
					permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW], // Array of permission keys required for this item
					featureKey: FeatureEnum.FEATURE_MY_TASK, //
					...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_ADD) && {
						add: '/pages/tasks/me?openAddDialog=true' //
					})
				}
			},
			'tasks',
			'tasks-team'
		); // The id of the section where this item should be added
	}

	/**
	 * Add navigation menu items for jobs browse and matching.
	 */
	private addJobsNavigationMenuItems(): void {
		this._navMenuBuilderService.addNavMenuItems(
			[
				{
					id: 'jobs-browse', // Unique identifier for the menu item
					title: 'Browse', // The title of the menu item
					icon: 'fas fa-list', // The icon class for the menu item, using FontAwesome in this case
					link: '/pages/jobs/search', // The link where the menu item directs
					data: {
						translationKey: 'MENU.JOBS_SEARCH', // Key for translation (i18n)
						permissionKeys: [PermissionsEnum.ORG_JOB_SEARCH] // Array of permission keys required for this item
					}
				},
				{
					id: 'jobs-matching', // Unique identifier for the menu item
					title: 'Matching', // The title of the menu item
					icon: 'fas fa-user', // The icon class for the menu item, using FontAwesome in this case
					link: '/pages/jobs/matching', // The link where the menu item directs
					data: {
						translationKey: 'MENU.JOBS_MATCHING', // Key for translation (i18n)
						permissionKeys: [PermissionsEnum.ORG_JOB_MATCHING_VIEW] // Array of permission keys required for this item
					}
				}
			],
			'jobs',
			'jobs-proposal-template'
		); // The id of the section where this item should be added
	}

	/**
	 * Removes the navigation menu items related to jobs.
	 */
	private removeJobsNavigationMenuItems(): void {
		// Remove the specified menu items related to jobs from the 'jobs' section
		this._navMenuBuilderService.removeNavMenuItems(['jobs-browse', 'jobs-matching'], 'jobs');
	}

	/**
	 * Retrieves and processes integration entity settings for the specified organization.
	 * This function fetches integration data, filters, and updates the job matching entity state.
	 * If the organization is not available, the function exits early.
	 */
	getIntegrationEntitySettings(): void {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		// Extract necessary properties from the organization
		const { id: organizationId, tenantId } = this.organization;

		// Fetch integration data from the service based on specified options
		const integration$ = this._integrationsService.getIntegrationByOptions({
			organizationId,
			tenantId,
			name: IntegrationEnum.GAUZY_AI,
			relations: ['entitySettings']
		});

		// Update job matching entity setting using the integration$ observable
		this._integrationEntitySettingServiceStoreService.updateAIJobMatchingEntity(integration$).subscribe();
	}

	/**
	 * Retrieves the report menu items for a specific organization.
	 *
	 * @return {Promise<void>} - A promise that resolves when the report menu items are retrieved.
	 */
	async getReportsMenus(): Promise<void> {
		if (!this.organization) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		await this.reportService.getReportMenuItems({ tenantId, organizationId });
	}

	/*
	 * This is app entry point after login
	 */
	private async _createEntryPoint() {
		const id = this.store.userId;

		if (!id) return;

		//Load permissions
		this._permissionsService.loadPermissions();

		const relations = ['role', 'tenant', 'tenant.featureOrganizations', 'tenant.featureOrganizations.feature'];
		this.user = await this.usersService.getMe(relations, true);

		this.authStrategy.electronAuthentication({
			user: this.user,
			token: this.store.token
		});

		//When a new user registers & logs in for the first time, he/she does not have tenantId.
		//In this case, we have to redirect the user to the onboarding page to create their first organization, tenant, role.
		if (!this.user.tenantId) {
			this.router.navigate(['/onboarding/tenant']);
			return;
		}

		this.store.user = this.user;

		//tenant enabled/disabled features for relatives organizations
		const { tenant } = this.user;
		this.store.featureTenant = tenant.featureOrganizations.filter((item) => !item.organizationId);
	}

	ngOnDestroy() {}
}
