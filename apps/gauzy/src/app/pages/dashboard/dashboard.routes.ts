import { Route } from '@angular/router';
import {
	BookmarkQueryParamsResolver,
	defaultDashboardGuard,
	PageRouteRegistryService,
	PermissionsGuard,
	standardDashboardGuard
} from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { DateRangePickerResolver } from '@gauzy/ui-core/shared';
import { DashboardComponent } from './dashboard.component';
import { HumanResourcesComponent } from './human-resources/human-resources.component';
import { AccountingComponent } from './accounting/accounting.component';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { TeamComponent } from './team/team.component';

/**
 * Creates the dashboard child routes.
 *
 * Spreads any plugin-contributed routes registered at the 'dashboard-sections'
 * location via {@link PageRouteRegistryService.getPageLocationRoutes}.
 *
 * @param _pageRouteRegistryService - Service for retrieving plugin-registered routes.
 * @returns Angular Route array for the dashboard feature.
 */
export function createDashboardRoutes(_pageRouteRegistryService: PageRouteRegistryService): Route[] {
	return [
		{
			path: '',
			component: DashboardComponent,
			data: {
				tabsetId: 'dashboard-page'
			},
			children: [
				{
					// Lands on the user's default custom dashboard when one exists,
					// otherwise redirects to the standard time-tracking tab.
					path: '',
					pathMatch: 'full',
					canActivate: [defaultDashboardGuard],
					children: []
				},
				{
					// Componentless intermediate hop used to force re-creation of the
					// widget host when switching between two custom dashboards.
					path: 'switching',
					children: []
				},
				{
					path: 'accounting',
					component: AccountingComponent,
					canActivate: [standardDashboardGuard],
					data: {
						selectors: {
							project: false
						},
						datePicker: {
							unitOfTime: 'week'
						}
					},
					resolve: {
						dates: DateRangePickerResolver,
						bookmarkParams: BookmarkQueryParamsResolver
					}
				},
				{
					path: 'hr',
					component: HumanResourcesComponent,
					canActivate: [standardDashboardGuard],
					data: {
						selectors: {
							project: false
						},
						datePicker: {
							unitOfTime: 'month'
						}
					},
					resolve: {
						dates: DateRangePickerResolver,
						bookmarkParams: BookmarkQueryParamsResolver
					}
				},

				{
					path: 'project-management',
					component: ProjectManagementComponent,
					canActivate: [PermissionsGuard, standardDashboardGuard],
					data: {
						datePicker: {
							unitOfTime: 'month'
						},
						permissions: {
							only: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.PROJECT_MANAGEMENT_DASHBOARD]
						}
					},
					resolve: {
						dates: DateRangePickerResolver,
						bookmarkParams: BookmarkQueryParamsResolver
					}
				},
				{
					path: 'teams',
					component: TeamComponent,
					canActivate: [PermissionsGuard, standardDashboardGuard],
					data: {
						datePicker: {
							unitOfTime: 'day',
							isSingleDatePicker: true,
							isLockDatePicker: true,
							isDisableFutureDate: true
						},
						selectors: {
							project: false,
							employee: true
						},
						permissions: {
							only: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TEAM_DASHBOARD]
						}
					},
					resolve: {
						dates: DateRangePickerResolver,
						bookmarkParams: BookmarkQueryParamsResolver
					}
				},
				..._pageRouteRegistryService.getPageLocationRoutes('dashboard-sections')
			]
		}
	];
}
