import { DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { BaseEntity, CrudService, RequestContext } from '@gauzy/core';

/**
 * A CRUD service whose writes are scoped to the caller's tenant.
 *
 * **Why this exists.** The services of this package extend `CrudService` rather than
 * `TenantAwareCrudService`, because their reads are already scoped by hand — every one of them builds
 * its `where` from a `scope` getter — and the base class's extra machinery was not wanted. What that
 * left behind is the half nobody scoped: `update` and `delete` are *inherited*, they take a bare
 * identifier, and `CrudService` issues `repository.update(id, ...)` and `repository.delete(id)` with
 * no predicate beyond it. A route reached with another tenant's identifier passed its permission check
 * — the permission is evaluated against the caller's own role and never against the row — and the
 * statement landed on the foreign row. The post-write read that follows is scoped, so the caller saw a
 * 404 *after* the write had already happened; a `DELETE` had no read at all and simply destroyed the
 * row.
 *
 * Every write therefore carries the scope in its own criteria, and a write that names a row outside
 * the caller's scope is refused as a miss before any statement runs. That is the same shape
 * `TenantAwareCrudService` has, stated here so these services keep their own scoped reads.
 *
 * **A criterion that names a `version` is a precondition rather than a locator**, so the pre-read is
 * skipped for it — a conditional write's whole point is that the comparison and the statement are one,
 * and reading first would answer "not found" for a row that exists and has merely moved on. The scope
 * still travels into the statement, which is what makes the write safe.
 */
export abstract class TenantScopedCrudService<T extends BaseEntity> extends CrudService<T> {
	/**
	 * The tenant and organization of the caller.
	 *
	 * Overridden by the services that already declare one of their own; the shape is identical, and
	 * this is the fallback for those that do not.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * The scope a *statement* can carry.
	 *
	 * The tenant, and deliberately not the organization. That is the boundary `TenantAwareCrudService`
	 * predicates every one of its writes on, and it is the boundary that was breached: a caller of one
	 * tenant could address a row of another. An organization is a narrower scope *inside* a tenant, and
	 * a caller legitimately works across several of them — each of these services already narrows its
	 * own reads to `{ tenantId, organizationId }` through `scope`, and the route that reads a row back
	 * after writing it is where an organization mismatch is answered. Putting it in the statement as
	 * well would turn an edit of a sibling organization's row into a silent no-op.
	 *
	 * Only the conditions that are present: a write made with no caller in context — a seeder, a job,
	 * a migration — has no tenant to be scoped by, and predicating its statement on an absent one
	 * would match nothing rather than matching its own rows.
	 *
	 * @returns The conditions a write is predicated on, beyond the row's identity.
	 */
	protected get writeScope(): Record<string, unknown> {
		const tenantId = RequestContext.currentTenantId();

		return tenantId ? { tenantId } : {};
	}

	/**
	 * Writes the fields a caller changed onto a row of the caller's own tenant.
	 *
	 * @param id The row's identifier, or the conditions it must satisfy.
	 * @param partialEntity The columns to write.
	 * @returns The update result, or the updated row, whichever the ORM answers.
	 * @throws NotFoundException when no row of the caller's scope matches.
	 */
	public async update(
		id: string | number | FindOptionsWhere<T>,
		partialEntity: QueryDeepPartialEntity<T>
	): Promise<UpdateResult | T> {
		const criteria = this.criteriaOf(id);
		const scoped = { ...criteria, ...this.writeScope } as FindOptionsWhere<T>;

		if (!('version' in criteria)) {
			await this.findOneByWhereOptions(scoped);
		}

		return super.update(scoped, partialEntity);
	}

	/**
	 * Deletes a row of the caller's own tenant.
	 *
	 * @param criteria The row's identifier, or the conditions it must satisfy.
	 * @returns The deletion result.
	 * @throws NotFoundException when no row of the caller's scope matches.
	 */
	public async delete(criteria: string | number | FindOptionsWhere<T>): Promise<DeleteResult> {
		const scoped = { ...this.criteriaOf(criteria), ...this.writeScope } as FindOptionsWhere<T>;

		await this.findOneByWhereOptions(scoped);

		return super.delete(scoped);
	}

	/**
	 * Soft-deletes a row of the caller's own tenant.
	 *
	 * @param criteria The row's identifier, or the conditions it must satisfy.
	 * @returns The update result, or the row, whichever the ORM answers.
	 * @throws NotFoundException when no row of the caller's scope matches.
	 */
	public async softDelete(criteria: string | number | FindOptionsWhere<T>): Promise<UpdateResult | T> {
		const scoped = { ...this.criteriaOf(criteria), ...this.writeScope } as FindOptionsWhere<T>;

		await this.findOneByWhereOptions(scoped);

		return super.softDelete(scoped);
	}

	/**
	 * @param criteria What a caller addressed the row by.
	 * @returns The same thing as a conditions object, so the scope can be merged into it.
	 */
	private criteriaOf(criteria: unknown): FindOptionsWhere<T> {
		if (typeof criteria === 'string' || typeof criteria === 'number') {
			return { id: criteria } as FindOptionsWhere<T>;
		}

		return (criteria ?? {}) as FindOptionsWhere<T>;
	}
}
