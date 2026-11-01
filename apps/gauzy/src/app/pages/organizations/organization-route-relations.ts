import { Data } from '@angular/router';
import { Observable, catchError, defaultIfEmpty, forkJoin, map, of, take } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';

/**
 * Relations a route asks the organization read for only when the user holds the permission each one names, as
 * `permittedRelations` in the route's data.
 *
 * The API answers an organization read with some relations (the organization's `contact`, for one) only to a caller
 * who holds their permission, and refuses the whole read otherwise (`ORGANIZATION_SENSITIVE_RELATIONS`). A page that
 * every one of its users may open, but that uses such a relation when it can, names it here rather than in
 * `relations`, so a user without that permission still opens the page.
 */
export type IPermittedRelations = Readonly<Record<string, PermissionsEnum>>;

/** Whether the user holds a permission. */
export type HoldsPermission = (permission: PermissionsEnum) => Observable<boolean>;

/**
 * The relations a route's organization read asks for: each of its `relations`, and each of its `permittedRelations`
 * whose permission the user holds. A permission that cannot be checked counts as not held: the page still opens,
 * without that relation.
 *
 * @param data - The route's data.
 * @param holds - Whether the user holds a permission.
 */
export function organizationRouteRelations(data: Data | undefined, holds: HoldsPermission): Observable<string[]> {
	const relations: string[] = [...((data?.['relations'] as string[]) ?? [])];
	const permitted = Object.entries((data?.['permittedRelations'] as IPermittedRelations) ?? {});
	if (permitted.length === 0) {
		return of(relations);
	}

	return forkJoin(
		permitted.map(([relation, permission]) =>
			holds(permission).pipe(
				take(1),
				map((held) => (held === true ? [relation] : [])),
				defaultIfEmpty([] as string[]),
				catchError(() => of([] as string[]))
			)
		)
	).pipe(map((granted) => [...relations, ...granted.flat()]));
}

/**
 * Whether the user holds a permission: yes at once when the permissions the app has loaded include it, and otherwise
 * as the API answers. On a direct link to a page the app's permissions may not have loaded yet, and the API is what
 * decides the read anyway.
 *
 * @param store - The app's loaded permissions.
 * @param auth - The API's permission check (`GET /auth/permissions`).
 */
export function permissionHolder(
	store: { hasPermission(permission: PermissionsEnum): boolean },
	auth: { hasPermissions(...permissions: PermissionsEnum[]): Observable<boolean> }
): HoldsPermission {
	return (permission) => (store.hasPermission(permission) ? of(true) : auth.hasPermissions(permission));
}
