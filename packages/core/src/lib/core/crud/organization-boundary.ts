import { ID, RolesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from '../context';

/**
 * The roles that reach every organization of their tenant.
 */
export const TENANT_ADMIN_ROLES: ReadonlyArray<RolesEnum> = Object.freeze([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);

/**
 * The organization a caller is confined to.
 *
 * **The rule (owner decision, 2026-10-22).** A tenant admin — role `SUPER_ADMIN` or `ADMIN` — reaches every
 * organization of the tenant, for everything. Everyone else is limited by their permissions AND to the one
 * organization of their token: `RequestContext.currentOrganizationId()`, the organization they last switched to,
 * which `JwtStrategy` attaches only after checking that the user is an active member of it. A caller of two
 * organizations of one tenant therefore sees and edits the one they switched to, and switches to reach the other —
 * which the Gauzy UI already does, minting a new token per organization.
 */
export interface IOrganizationBoundary {
	/** The organization of the caller's token; `null` when there is none, in which case no organization is reached. */
	readonly organizationId: ID | null;
}

/** The request-scoped counter of open {@link runOutsideOrganizationBoundary} blocks. */
const OUTSIDE_ORGANIZATION_BOUNDARY_KEY = 'organizationBoundary:outside';

/** How many {@link runOutsideOrganizationBoundary} blocks are open in the current request. */
function outsideOrganizationBoundaryDepth(): number {
	try {
		return RequestContext['clsService']?.get(OUTSIDE_ORGANIZATION_BOUNDARY_KEY) ?? 0;
	} catch {
		return 0;
	}
}

/** Stores how many {@link runOutsideOrganizationBoundary} blocks are open in the current request. */
function setOutsideOrganizationBoundaryDepth(depth: number): void {
	try {
		RequestContext['clsService']?.set(OUTSIDE_ORGANIZATION_BOUNDARY_KEY, depth);
	} catch {
		// No request context: there is no boundary to lift either.
	}
}

/**
 * Runs a callback with the organization boundary lifted for every service, for the few flows of a signed-in caller
 * that must cross organizations by design, once they have checked the caller's right to do so by other means:
 * switching to another organization the caller is a member of, accepting an invitation addressed to them, or seeding
 * an organization they have just created. A service's own bypass, `withoutOrganizationBoundary`, is narrower and is
 * preferred wherever the crossing stays inside one service.
 *
 * Reference counted and request scoped, like the employee filter's bypass: other requests are never affected. It lifts
 * the boundary of the CRUD base only; the check on an organization a request names
 * (`@IsOrganizationBelongsToUser()`) is not affected.
 *
 * @param callback The async function to run outside the boundary.
 * @returns The result of the callback.
 */
export async function runOutsideOrganizationBoundary<R>(callback: () => Promise<R>): Promise<R> {
	setOutsideOrganizationBoundaryDepth(outsideOrganizationBoundaryDepth() + 1);
	try {
		return await callback();
	} finally {
		setOutsideOrganizationBoundaryDepth(Math.max(0, outsideOrganizationBoundaryDepth() - 1));
	}
}

/**
 * The organization boundary of the current request.
 *
 * @returns The boundary, or `null` when the caller is not confined: there is no signed-in caller (a job, a public
 * route — the tenant scoping alone applies to those, as before), the caller is a tenant admin, or the call runs
 * inside {@link runOutsideOrganizationBoundary}. The role is the one the user holds now, read from the database for
 * this request, never the claim frozen into the token.
 */
export function currentOrganizationBoundary(): IOrganizationBoundary | null {
	if (!RequestContext.currentUser()) {
		return null;
	}
	if (outsideOrganizationBoundaryDepth() > 0) {
		return null;
	}
	if (RequestContext.hasRoles([...TENANT_ADMIN_ROLES])) {
		return null;
	}
	return { organizationId: RequestContext.currentOrganizationId() ?? null };
}

/**
 * Whether a row of the given organization lies inside a boundary.
 *
 * A row stored without an organization belongs to the tenant rather than to one of its organizations, and lies
 * inside every boundary of that tenant.
 *
 * @param organizationId The row's organization.
 * @param boundary The boundary; the current request's when omitted.
 * @returns True when the caller may reach the row's organization.
 */
export function isWithinOrganizationBoundary(
	organizationId: ID | null | undefined,
	boundary: IOrganizationBoundary | null = currentOrganizationBoundary()
): boolean {
	if (!boundary || !isNotEmpty(organizationId)) {
		return true;
	}
	return isNotEmpty(boundary.organizationId) && String(organizationId) === String(boundary.organizationId);
}
