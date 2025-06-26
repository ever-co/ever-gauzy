import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, from, of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseEntityEnum, IFavorite, PermissionsEnum } from '@gauzy/contracts';
import { FavoriteService } from './favorite.service';
import { Store } from '../store/store.service';
import { NavMenuSectionItem } from '../nav-builder/nav-builder-types';

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class FavoriteStoreService {
	private readonly _favoriteItems$ = new BehaviorSubject<NavMenuSectionItem[]>([]);
	public readonly favoriteItems$ = this._favoriteItems$.asObservable();

	constructor(private readonly _favoriteService: FavoriteService, private readonly _store: Store) {
		this._listenToChangesAndLoadFavorites();
	}

	private _listenToChangesAndLoadFavorites(): void {
		combineLatest([this._store.selectedOrganization$.pipe(filter((org) => !!org)), this._store.selectedEmployee$])
			.pipe(
				switchMap(() => from(this._loadFavorites())),
				catchError((error) => {
					console.error('Error loading favorites in store', error);
					return of([]);
				}),
				untilDestroyed(this)
			)
			.subscribe((items) => {
				this._favoriteItems$.next(items);
			});
	}

	private async _loadFavorites(): Promise<NavMenuSectionItem[]> {
		const { id: organizationId, tenantId } = this._store.selectedOrganization || {};
		if (!organizationId) {
			return [];
		}

		const isAdmin = this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW);
		const employeeId = this._store.selectedEmployee?.id;

		let favoriteStubsPromise: Promise<{ items: IFavorite[]; total: number }>;

		if (isAdmin && !employeeId) {
			favoriteStubsPromise = this._favoriteService.findAll({ where: { organizationId, tenantId } });
		} else {
			const targetEmployeeId = employeeId || this._store.user.employee?.id;
			if (!targetEmployeeId) {
				return [];
			}
			favoriteStubsPromise = this._favoriteService.findByEmployee({
				where: { organizationId, tenantId, employeeId: targetEmployeeId }
			});
		}

		const { items: favoriteStubs } = await favoriteStubsPromise;

		if (!favoriteStubs.length) {
			return [];
		}

		const groupedFavorites = favoriteStubs.reduce((acc, fav) => {
			(acc[fav.entity] = acc[fav.entity] || []).push(fav);
			return acc;
		}, {} as Record<BaseEntityEnum, IFavorite[]>);

		const favoritePromises = [];

		for (const entityType of Object.keys(groupedFavorites)) {
			const promise = this._favoriteService
				.getFavoriteDetails({
					where: {
						entity: entityType,
						organizationId,
						tenantId
					}
				})
				.then(({ items: details }) => {
					return details.map((detail: any) => {
						const rawTitle = detail.name || detail.title || 'Untitled';
						const title = this._truncateTitle(rawTitle);
						return {
							id: `favorite-${entityType}-${detail.id}`,
							title,
							icon: this._getFavoriteIcon(entityType as BaseEntityEnum),
							link: this._getFavoriteLink(entityType as BaseEntityEnum, detail.id),
							data: {
								translationKey: title
							}
						};
					});
				});
			favoritePromises.push(promise);
		}

		const allFavoriteItems = await Promise.all(favoritePromises);
		return allFavoriteItems.flat();
	}

	private _truncateTitle(title: string, maxLength = 24): string {
		if (!title) return '';
		return title.length > maxLength ? title.slice(0, maxLength - 3) + '...' : title;
	}

	private _getFavoriteIcon(entityType: BaseEntityEnum): string {
		switch (entityType) {
			case BaseEntityEnum.OrganizationProject:
				return 'fas fa-book';
			case BaseEntityEnum.Task:
				return 'fas fa-tasks';
			case BaseEntityEnum.Employee:
				return 'fas fa-user-friends';
			case BaseEntityEnum.Candidate:
				return 'fas fa-user-tie';
			case BaseEntityEnum.Contact:
				return 'fas fa-address-book';
			case BaseEntityEnum.OrganizationTeam:
				return 'fas fa-users';
			case BaseEntityEnum.OrganizationVendor:
				return 'fas fa-truck';
			case BaseEntityEnum.OrganizationSprint:
				return 'fas fa-running';
			case BaseEntityEnum.OrganizationProjectModule:
				return 'fas fa-puzzle-piece';
			case BaseEntityEnum.TaskView:
				return 'fas fa-eye';
			case BaseEntityEnum.OrganizationDepartment:
				return 'fas fa-sitemap';
			case BaseEntityEnum.OrganizationDocument:
				return 'fas fa-file-alt';
			case BaseEntityEnum.Expense:
				return 'fas fa-money-bill-wave';
			case BaseEntityEnum.Invoice:
				return 'fas fa-file-invoice-dollar';
			case BaseEntityEnum.Income:
				return 'fas fa-coins';
			case BaseEntityEnum.DailyPlan:
				return 'fas fa-calendar-day';
			case BaseEntityEnum.Dashboard:
				return 'fas fa-th-large';
			case BaseEntityEnum.DashboardWidget:
				return 'fas fa-th';
			case BaseEntityEnum.ResourceLink:
				return 'fas fa-link';
			case BaseEntityEnum.ScreeningTask:
				return 'fas fa-clipboard-check';
			case BaseEntityEnum.TaskLinkedIssue:
				return 'fas fa-link';
			case BaseEntityEnum.User:
				return 'fas fa-user';
			case BaseEntityEnum.Tenant:
				return 'fas fa-building';
			case BaseEntityEnum.OrganizationContact:
				return 'fas fa-address-card';
			case BaseEntityEnum.Comment:
				return 'fas fa-comments';
			case BaseEntityEnum.Currency:
				return 'fas fa-coins';
			case BaseEntityEnum.Language:
				return 'fas fa-language';
			default:
				return 'far fa-star';
		}
	}

	private _getFavoriteLink(entityType: BaseEntityEnum, entityId: string): string {
		switch (entityType) {
			case BaseEntityEnum.OrganizationProject:
				return `/pages/organization/projects/${entityId}/edit`;
			case BaseEntityEnum.Task:
				return `/pages/tasks/dashboard?taskId=${entityId}`;
			case BaseEntityEnum.Employee:
				return `/pages/employees/edit/${entityId}`;
			case BaseEntityEnum.Candidate:
				return `/pages/employees/candidates/edit/${entityId}`;
			case BaseEntityEnum.Contact:
				return `/pages/contacts/edit/${entityId}`;
			case BaseEntityEnum.OrganizationTeam:
				return `/pages/organization/teams/edit/${entityId}`;
			case BaseEntityEnum.OrganizationVendor:
				return `/pages/organization/vendors/edit/${entityId}`;
			case BaseEntityEnum.OrganizationSprint:
				return `/pages/organization/sprints/edit/${entityId}`;
			case BaseEntityEnum.OrganizationProjectModule:
				return `/pages/organization/projects/modules/${entityId}/edit`;
			case BaseEntityEnum.TaskView:
				return `/pages/tasks/views/${entityId}`;
			case BaseEntityEnum.OrganizationDepartment:
				return `/pages/organization/departments/edit/${entityId}`;
			case BaseEntityEnum.OrganizationDocument:
				return `/pages/organization/documents/edit/${entityId}`;
			case BaseEntityEnum.Expense:
				return `/pages/accounting/expenses/edit/${entityId}`;
			case BaseEntityEnum.Invoice:
				return `/pages/accounting/invoices/edit/${entityId}`;
			case BaseEntityEnum.Income:
				return `/pages/accounting/income/edit/${entityId}`;
			case BaseEntityEnum.DailyPlan:
				return `/pages/daily-plans/edit/${entityId}`;
			case BaseEntityEnum.Dashboard:
				return `/pages/dashboard`;
			case BaseEntityEnum.DashboardWidget:
				return `/pages/dashboard`;
			case BaseEntityEnum.ResourceLink:
				return `/pages/resource-links/edit/${entityId}`;
			case BaseEntityEnum.ScreeningTask:
				return `/pages/tasks/screening/edit/${entityId}`;
			case BaseEntityEnum.TaskLinkedIssue:
				return `/pages/tasks/linked-issues/edit/${entityId}`;
			case BaseEntityEnum.User:
				return `/pages/users/edit/${entityId}`;
			case BaseEntityEnum.Tenant:
				return `/pages/tenants/edit/${entityId}`;
			case BaseEntityEnum.OrganizationContact:
				return `/pages/organization/contacts/edit/${entityId}`;
			case BaseEntityEnum.Comment:
				return `/pages/comments/edit/${entityId}`;
			case BaseEntityEnum.Currency:
				return `/pages/settings/currencies/edit/${entityId}`;
			case BaseEntityEnum.Language:
				return `/pages/settings/languages/edit/${entityId}`;
			default:
				return '/';
		}
	}
}
