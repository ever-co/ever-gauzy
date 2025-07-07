import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, from, of, Subject, Subscription } from 'rxjs';
import { catchError, filter, startWith, switchMap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseEntityEnum, IFavorite, PermissionsEnum } from '@gauzy/contracts';
import { FavoriteService } from './favorite.service';
import { Store } from '../store/store.service';
import { NavMenuSectionItem } from '../nav-builder/nav-builder-types';
import { ENTITY_ICONS, ENTITY_LINKS } from './entities-mapping';

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class FavoriteStoreService {
	private readonly _favoriteItems$ = new BehaviorSubject<NavMenuSectionItem[]>([]);
	public readonly favoriteItems$ = this._favoriteItems$.asObservable();
	private readonly _refresh$ = new Subject<void>();
	protected _favoriteSubscription?: Subscription;

	constructor(private readonly _favoriteService: FavoriteService, private readonly _store: Store) {
		this._listenToChangesAndLoadFavorites();
	}

	public refreshFavorites(): void {
		this._refresh$.next();
	}

	private _listenToChangesAndLoadFavorites(): void {
		this._favoriteSubscription = combineLatest([
			this._store.selectedOrganization$.pipe(filter((org) => !!org)),
			this._refresh$.pipe(startWith(null))
		])
			.pipe(
				switchMap(() => from(this._loadFavorites())),
				catchError((error) => {
					console.error('Error loading favorites in store', error);
					this._favoriteItems$.next([]);
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
			favoriteStubsPromise = this._favoriteService.findAll({
				where: { organizationId, tenantId }
			});
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
				.then(({ items: details }: { items: IFavorite[]; total: number }) => {
					if (!details || !Array.isArray(details)) {
						return [];
					}

					return details
						.map((item) => {
							if (!item) {
								return null;
							}

							const rawTitle =
								(item as unknown as { name?: string; title?: string; profile_link?: string }).name ||
								(item as unknown as { name?: string; title?: string; profile_link?: string }).title ||
								(item as unknown as { name?: string; title?: string; profile_link?: string })
									.profile_link ||
								'Untitled';
							const title = this._truncateTitle(rawTitle);
							return {
								id: `favorite-${entityType}-${item.id}`,
								title,
								icon: this._getFavoriteIcon(entityType as BaseEntityEnum),
								link: this._getFavoriteLink(entityType as BaseEntityEnum, item.id),
								data: {
									translationKey: title
								}
							};
						})
						.filter(Boolean);
				})
				.catch((error) => {
					console.error(`Error loading favorites for ${entityType}:`, error);
					return [];
				});
			favoritePromises.push(promise);
		}

		const allFavoriteItems = await Promise.all(favoritePromises);
		return allFavoriteItems.flat();
	}

	private _truncateTitle(title: string, maxLength = 24): string {
		if (!title) return '';
		return title.length > maxLength ? `${title.slice(0, maxLength - 3)}...` : title;
	}

	private _getFavoriteIcon(entityType: BaseEntityEnum): string {
		return ENTITY_ICONS[entityType] || 'far fa-star';
	}

	private _getFavoriteLink(entityType: BaseEntityEnum, entityId: string): string {
		const linkFn = ENTITY_LINKS[entityType];
		return linkFn ? linkFn(entityId) : '/';
	}
}
