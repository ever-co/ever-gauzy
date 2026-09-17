import { NotFoundException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '../../context';
import { TenantAwareCrudService } from '../../crud/tenant-aware-crud.service';
import { TenantBaseEntity } from '../../entities/internal';

/**
 * Reusable tenant-isolation invariants for any `TenantAwareCrudService` subclass.
 *
 * These drive the REAL production service (and, through it, `TenantAwareCrudService` /
 * `CrudService`) against a fake repository seeded with two tenants' worth of data — see
 * `InMemoryTenantRepository` and `asTenantUser`/`createCrossTenantFixture`. The point is to turn
 * "we expect every repository to enforce tenant isolation" into something CI actually checks,
 * per the shared persistence-invariant framework this harness is the first slice of.
 *
 * Each "cannot" assertion is meant to be paired with a positive control (e.g.
 * {@link assertCanReadOwnTenant}) in the same spec, so a test failure that turns out to be "the
 * call always throws" is caught by the suite too.
 */

/** Tenant A must not be able to read a row that belongs to Tenant B by id. */
export async function assertCannotReadAcrossTenant<T extends TenantBaseEntity>(
	service: TenantAwareCrudService<T>,
	foreignId: ID
): Promise<void> {
	await expect(service.findOneByIdString(foreignId)).rejects.toThrow(NotFoundException);
}

/** Positive control for {@link assertCannotReadAcrossTenant}: the caller's own row IS visible. */
export async function assertCanReadOwnTenant<T extends TenantBaseEntity>(
	service: TenantAwareCrudService<T>,
	ownId: ID
): Promise<void> {
	await expect(service.findOneByIdString(ownId)).resolves.toBeDefined();
}

/** Tenant A must not be able to update a row that belongs to Tenant B. */
export async function assertCannotUpdateAcrossTenant<T extends TenantBaseEntity>(
	service: TenantAwareCrudService<T>,
	foreignId: ID,
	patch: Record<string, unknown> = { isActive: false }
): Promise<void> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await expect(service.update(foreignId, patch as any)).rejects.toThrow(NotFoundException);
}

/**
 * Tenant A must not be able to delete a row that belongs to Tenant B.
 *
 * Unlike read/update, `TenantAwareCrudService.delete` does not throw here: it merges the tenant
 * filter into the delete criteria and issues the DELETE, so a foreign id simply matches zero rows
 * (a legitimate no-op DELETE, not an error). The invariant is therefore: the call resolves with
 * zero affected rows, AND the foreign row is still present afterwards.
 */
export async function assertCannotDeleteAcrossTenant<T extends TenantBaseEntity>(
	service: TenantAwareCrudService<T>,
	foreignId: ID,
	stillExists: () => boolean | Promise<boolean>
): Promise<void> {
	const result = await service.delete(foreignId);
	expect((result as { affected?: number }).affected ?? 0).toBe(0);
	expect(await stillExists()).toBe(true);
}

/**
 * Tenant A must not be able to claim/overwrite a row that belongs to Tenant B by upserting with
 * its id (`create()`/`save()` with a smuggled foreign `id`). Guards the `assertNotForeignRow`
 * check in `TenantAwareCrudService`.
 */
export async function assertCannotClaimForeignRowOnWrite<T extends TenantBaseEntity>(
	service: TenantAwareCrudService<T>,
	foreignId: ID
): Promise<void> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await expect(service.save({ id: foreignId } as any)).rejects.toThrow(/belongs to another tenant/i);
}

/**
 * A tenant-scoped list (paginate/find) must never surface another tenant's rows.
 *
 * Checking only that `foreignId` is absent is not enough. `CrudService.paginate` returns at most 10
 * rows under TypeORM when no `take` is given, so once the table holds more than a page of rows, that
 * one foreign id can simply fall outside the page — the check then passes with tenant filtering
 * switched off entirely (reproduced against the persistence-invariant suite's real SQLite database).
 * So every row on the page must belong to the caller's own tenant, and the page must not be empty
 * (an empty page satisfies both checks without proving anything). Seed at least one own-tenant row
 * before calling this.
 */
export async function assertListExcludesOtherTenant<T extends TenantBaseEntity>(
	service: TenantAwareCrudService<T>,
	foreignId: ID
): Promise<void> {
	// The same tenant the service scopes by (`TenantAwareCrudService` reads it from
	// `RequestContext.currentUser()`, which `asTenantUser` points at the acting tenant).
	const ownTenantId = RequestContext.currentUser()?.tenantId;
	expect(ownTenantId).toBeTruthy();

	const { items } = await service.paginate();
	const rows = items as Array<{ id?: ID; tenantId?: ID }>;

	expect(rows.length).toBeGreaterThan(0);
	// Listing the offending rows (rather than a bare boolean) makes a failure show what leaked.
	expect(rows.filter((row) => row.tenantId !== ownTenantId)).toEqual([]);
	expect(rows.map((row) => row.id)).not.toContain(foreignId);
}
