import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, from, of, Subject, Subscription } from 'rxjs';
import { catchError, filter, startWith, switchMap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseEntityEnum, IFavorite, PermissionsEnum } from '@gauzy/contracts';
import { FavoriteService } from './favorite.service';
import { Store } from '../store/store.service';
import { NavMenuSectionItem } from '../nav-builder/nav-builder-types';
import { ENTITY_LINKS, ENTITY_TITLES, favoriteIcon, IFavoriteRecord } from './entities-mapping';

/** One favorited record, as the Favorites page lists it. */
export interface IFavoriteEntry {
	/** The favorite's own id, which removing it deletes. */
	favoriteId: string;
	/** That favorite is the user's own, not an organization-level pin. */
	own: boolean;
	/**
	 * The record is also pinned for the organization (a favorite saved without an employee, which every
	 * admin sees). Removing the user's own favorite of it leaves it listed.
	 */
	pinnedForOrganization: boolean;
	entity: BaseEntityEnum;
	entityId: string;
	/** The record's full name; the sidebar shortens it. */
	title: string;
	icon: string;
	link: string;
	/** When the favorite was saved, if the API returned it. */
	addedAt?: Date;
}

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class FavoriteStoreService {
	/** Every favorite of the signed-in user, newest first. */
	private readonly _favorites$ = new BehaviorSubject<IFavoriteEntry[]>([]);
	public readonly favorites$ = this._favorites$.asObservable();
	/** The same favorites as sidebar links. */
	private readonly _favoriteItems$ = new BehaviorSubject<NavMenuSectionItem[]>([]);
	public readonly favoriteItems$ = this._favoriteItems$.asObservable();
	private readonly _loading$ = new BehaviorSubject<boolean>(true);
	public readonly loading$ = this._loading$.asObservable();
	/**
	 * Whether the last read failed, in full or for some kinds of record, so a short or empty list is not
	 * mistaken for the user having no favorites. The sidebar still shows whatever did load.
	 */
	private readonly _loadFailed$ = new BehaviorSubject<boolean>(false);
	public readonly loadFailed$ = this._loadFailed$.asObservable();
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
				switchMap(() => {
					this._loading$.next(true);
					return from(this._loadFavorites()).pipe(
						catchError((error) => {
							console.error('Error loading favorites in store', error);
							return of({ entries: [] as IFavoriteEntry[], failed: true });
						})
					);
				}),
				untilDestroyed(this)
			)
			.subscribe(({ entries, failed }) => {
				this._favorites$.next(entries);
				this._favoriteItems$.next(entries.map((entry) => this._toMenuItem(entry)));
				this._loadFailed$.next(failed);
				this._loading$.next(false);
			});
	}

	/** The date, or undefined when it is missing or unparsable (a date pipe throws on an invalid one). */
	private _validDate(value: Date | string | undefined): Date | undefined {
		if (!value) {
			return undefined;
		}
		const date = new Date(value);
		return isNaN(date.getTime()) ? undefined : date;
	}

	private _toMenuItem(entry: IFavoriteEntry): NavMenuSectionItem {
		const title = this._truncateTitle(entry.title);
		return {
			id: `favorite-${entry.entity}-${entry.entityId}`,
			title,
			icon: entry.icon,
			link: entry.link,
			data: {
				translationKey: title
			}
		};
	}

	/**
	 * Reads the user's favorites. `failed` is set when the details of some kind of record could not be read:
	 * those favorites are left out and the rest returned.
	 */
	private async _loadFavorites(): Promise<{ entries: IFavoriteEntry[]; failed: boolean }> {
		const none = { entries: [] as IFavoriteEntry[], failed: false };
		const { id: organizationId, tenantId } = this._store.selectedOrganization || {};
		if (!organizationId) {
			return none;
		}

		// Favorites belong to the signed-in user (that's who the favorite toggle saves them for), so key the
		// sidebar off the user's own employee record. NOT `selectedEmployee`: the Edit Employee page sets it to
		// the employee being viewed, which used to load *their* favorites and leave the section empty/hidden.
		const employeeId = this._store.user?.employee?.id;
		const isAdmin = this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW);

		let favoriteStubs: IFavorite[];

		if (isAdmin) {
			// Admins see their own favorites plus organization-level pins (saved without an employee)
			const { items } = await this._favoriteService.findAll({
				where: { organizationId, tenantId }
			});
			favoriteStubs = items.filter((fav) => !fav.employeeId || fav.employeeId === employeeId);
		} else if (employeeId) {
			const { items } = await this._favoriteService.findByEmployee({
				where: { organizationId, tenantId, employeeId }
			});
			favoriteStubs = items;
		} else {
			return none;
		}

		if (!favoriteStubs.length) {
			return none;
		}

		let failed = false;

		const groupedFavorites = favoriteStubs.reduce((acc, fav) => {
			(acc[fav.entity] = acc[fav.entity] || []).push(fav);
			return acc;
		}, {} as Record<BaseEntityEnum, IFavorite[]>);

		// The favorite behind each record, the user's own ahead of an organization-level pin of the same record,
		// and which records carry such a pin (only admins read those).
		const stubByRecord = new Map<string, IFavorite>();
		const pinnedRecords = new Set<string>();
		for (const fav of favoriteStubs) {
			const key = `${fav.entity}:${fav.entityId}`;
			if (!fav.employeeId) {
				pinnedRecords.add(key);
			}
			if (!stubByRecord.has(key) || fav.employeeId === employeeId) {
				stubByRecord.set(key, fav);
			}
		}

		const favoritePromises: Promise<IFavoriteEntry[]>[] = [];

		for (const entityType of Object.keys(groupedFavorites)) {
			// The details endpoint returns every favorited record of this type it can see (for an admin,
			// other users' too), so keep only the ones in this user's favorites.
			const favoriteEntityIds = new Set(
				groupedFavorites[entityType as BaseEntityEnum].map((fav: IFavorite) => fav.entityId)
			);
			const promise = this._favoriteService
				.getFavoriteDetails({
					where: {
						entity: entityType,
						organizationId,
						tenantId,
						...(!isAdmin && employeeId && { employeeId })
					}
				})
				.then(({ items }: { items: IFavorite[]; total: number }) =>
					this._withPersonNames(
						entityType as BaseEntityEnum,
						Array.isArray(items) ? items.filter((item) => item && favoriteEntityIds.has(item.id)) : items
					)
				)
				.then((details) => {
					if (!details || !Array.isArray(details)) {
						return [];
					}

					return details
						.map((item): IFavoriteEntry | null => {
							const key = `${entityType}:${item?.id}`;
							const stub = item && stubByRecord.get(key);
							if (!stub) {
								return null;
							}

							return {
								favoriteId: stub.id,
								own: !!stub.employeeId && stub.employeeId === employeeId,
								pinnedForOrganization: pinnedRecords.has(key),
								entity: entityType as BaseEntityEnum,
								entityId: item.id,
								title: this._getFavoriteTitle(item, entityType as BaseEntityEnum) || 'Untitled',
								icon: this._getFavoriteIcon(entityType as BaseEntityEnum, item),
								link: this._getFavoriteLink(entityType as BaseEntityEnum, item.id, item),
								addedAt: this._validDate(stub.createdAt)
							};
						})
						.filter((entry): entry is IFavoriteEntry => !!entry);
				})
				.catch((error) => {
					console.error(`Error loading favorites for ${entityType}:`, error);
					failed = true;
					return [] as IFavoriteEntry[];
				});
			favoritePromises.push(promise);
		}

		const addedAt = (entry: IFavoriteEntry): number => entry.addedAt?.getTime() || 0;

		// Newest first: the sidebar shows only the first few, so a record just starred is always among them.
		const allFavoriteItems = await Promise.all(favoritePromises);
		return { entries: allFavoriteItems.flat().sort((a, b) => addedAt(b) - addedAt(a)), failed };
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

		// Skip lookups the caller cannot resolve instead of sending one doomed request per item on every
		// refresh: the candidate route needs ORG_CANDIDATES_VIEW, and without CHANGE_SELECTED_EMPLOYEE the
		// employee route only ever answers with the caller's own record.
		const ownEmployeeId = this._store.user?.employee?.id;
		const canResolve = (id: string): boolean =>
			entityType === BaseEntityEnum.Candidate
				? this._store.hasPermission(PermissionsEnum.ORG_CANDIDATES_VIEW)
				: this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) || id === ownEmployeeId;

		return Promise.all(
			items.map(async (item) => {
				if (!item?.id || (item as { user?: unknown }).user || !canResolve(item.id)) {
					return item;
				}
				try {
					const person = await this._favoriteService.getPersonWithUser(
						entityType as BaseEntityEnum.Employee | BaseEntityEnum.Candidate,
						item.id
					);
					// Without CHANGE_SELECTED_EMPLOYEE the employee route ignores the requested id and returns the
					// caller's own record; never label a colleague's link with the caller's name.
					if (person?.id !== item.id) {
						return item;
					}
					return { ...item, user: person.user } as IFavorite;
				} catch {
					return item;
				}
			})
		);
	}

	/**
	 * Resolves a display name for a favorite's entity. Employees and candidates have no name of their own,
	 * it comes from the linked user and is shortened to "First L." (e.g. "Roster R."). Records known by
	 * other fields (an invoice's number and client, an expense's vendor and amount) are named by their
	 * type's `ENTITY_TITLES` entry.
	 */
	private _getFavoriteTitle(item: unknown, entityType?: BaseEntityEnum): string | undefined {
		const byType = entityType && ENTITY_TITLES[entityType]?.(item as IFavoriteRecord);
		if (byType) {
			return byType;
		}
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

	private _getFavoriteIcon(entityType: BaseEntityEnum, record?: unknown): string {
		return favoriteIcon(entityType, record as IFavoriteRecord) || 'far fa-star';
	}

	/**
	 * The record's own page. The details row is handed to the builder so a type with more than one full
	 * view (a document's kind, an estimate) opens the right one.
	 */
	private _getFavoriteLink(entityType: BaseEntityEnum, entityId: string, record?: unknown): string {
		const linkFn = ENTITY_LINKS[entityType];
		return linkFn ? linkFn(entityId, record as IFavoriteRecord) : '/';
	}
}
