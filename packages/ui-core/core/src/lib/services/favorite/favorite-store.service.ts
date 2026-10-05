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

		// Favorites belong to the signed-in user (that's who the favorite toggle saves them for), so key the
		// sidebar off the user's own employee record. NOT `selectedEmployee`: the Edit Employee page sets it to
		// the employee being viewed, which used to load *their* favorites and leave the section empty/hidden.
		const employeeId = this._store.user?.employee?.id;
		const isAdmin = this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW);

		let favoriteStubsPromise: Promise<{ items: IFavorite[]; total: number }>;

		if (employeeId) {
			favoriteStubsPromise = this._favoriteService.findByEmployee({
				where: { organizationId, tenantId, employeeId }
			});
		} else if (isAdmin) {
			// Admin without an employee record: favorites are saved at the organization level
			favoriteStubsPromise = this._favoriteService.findAll({
				where: { organizationId, tenantId }
			});
		} else {
			return [];
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
						tenantId,
						...(employeeId && { employeeId })
					}
				})
				.then(({ items }: { items: IFavorite[]; total: number }) =>
					this._withPersonNames(entityType as BaseEntityEnum, items)
				)
				.then((details) => {
					if (!details || !Array.isArray(details)) {
						return [];
					}

					return details
						.map((item) => {
							if (!item) {
								return null;
							}

							const rawTitle = this._getFavoriteTitle(item) || 'Untitled';
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

	/**
	 * Employees and candidates get their name from the linked user. Older APIs return them from the
	 * favorite details endpoint without it (leaving only the "roster-r" style slug), so load any
	 * missing user here.
	 */
	private async _withPersonNames(entityType: BaseEntityEnum, items: IFavorite[]): Promise<IFavorite[]> {
		if (
			!Array.isArray(items) ||
			(entityType !== BaseEntityEnum.Employee && entityType !== BaseEntityEnum.Candidate)
		) {
			return items;
		}

		return Promise.all(
			items.map(async (item) => {
				if (!item?.id || (item as { user?: unknown }).user) {
					return item;
				}
				try {
					const person = await this._favoriteService.getPersonWithUser(
						entityType as BaseEntityEnum.Employee | BaseEntityEnum.Candidate,
						item.id
					);
					return { ...item, user: person?.user } as IFavorite;
				} catch {
					return item;
				}
			})
		);
	}

	/**
	 * Resolves a display name for a favorite's entity. Employees and candidates have no name of their own,
	 * it comes from the linked user and is shortened to "First L." (e.g. "Roster R.").
	 */
	private _getFavoriteTitle(item: unknown): string | undefined {
		const entity = item as {
			name?: string;
			title?: string;
			fullName?: string;
			profile_link?: string;
			user?: { firstName?: string; lastName?: string; email?: string };
		};
		if (entity.name || entity.title) {
			return entity.name || entity.title;
		}

		const firstName = entity.user?.firstName?.trim();
		const lastName = entity.user?.lastName?.trim();
		if (firstName || lastName) {
			return firstName && lastName ? `${firstName} ${lastName.charAt(0).toUpperCase()}.` : firstName || lastName;
		}

		return entity.fullName || entity.user?.email || entity.profile_link;
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
