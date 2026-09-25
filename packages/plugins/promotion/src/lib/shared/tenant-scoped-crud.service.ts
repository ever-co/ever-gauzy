import { DeleteResult, FindOptionsWhere, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { BaseEntity, CrudService, ITryRequest, RequestContext } from '@gauzy/core';

/**
 * The find options a read by identifier accepts, as the base class declares them.
 *
 * Named through the base's own signature rather than imported, because the kernel does not export the
 * union from its barrel, and a restated shape would drift from the one `CrudService` actually takes.
 */
type FindOneOptionsOf<T extends BaseEntity> = Parameters<CrudService<T>['findOneByIdString']>[1];

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
 *
 * **The withdraw/restore pair and the reads by identifier are scoped too.** `softRemove` and
 * `softRecover` are inherited as well, and `CrudService` resolves the row they act on through
 * `findOneByIdString` — a read by identifier alone, on both ORM branches. The inherited
 * `DELETE /:id/soft` and `PUT /:id/recover` routes and the `softDelete<Resource>` / `recover<Resource>`
 * mutations all reach them, so a caller holding a delete grant in one tenant withdrew or restored
 * another tenant's promotion, coupon or gift card by naming its id, and was answered with the foreign
 * row. Those reads now carry the caller's tenant **and** organization — the same `{ tenantId,
 * organizationId }` every hand-written read of these services is narrowed by — so the row is resolved
 * inside the caller's scope before either ORM touches it, and a row outside it is the platform's 404.
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
	 * The scope a *read by identifier* is narrowed to.
	 *
	 * The tenant and the organization — the whole of {@link scope}, which is what every hand-written read
	 * of these services already states. Unlike {@link writeScope}, the organization belongs here: this is
	 * the read that answers "is this row the caller's", and the reasoning `writeScope` gives for leaving
	 * the organization out of a statement is that the *read* is where an organization mismatch is
	 * answered. A read that left it out would let a withdrawal reach a sibling organization's row that no
	 * other read of these services would show the caller.
	 *
	 * Only the conditions that are present, for the reason `writeScope` states: a read made with no caller
	 * in context has nothing to be narrowed by, and a condition on an absent value would match nothing on
	 * one ORM and everything on the other rather than meaning the same thing on both.
	 *
	 * @returns The conditions a read by identifier is predicated on, beyond the identifier.
	 */
	protected get readScope(): Record<string, unknown> {
		const { tenantId, organizationId } = this.scope;

		return {
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		};
	}

	/**
	 * Reads a row of the caller's own tenant and organization by its identifier.
	 *
	 * The base read matches the identifier alone, on both ORM branches; this is the one every inherited
	 * read by identifier goes through — `softRemove` and `softRecover` among them — so narrowing it here is
	 * what narrows them.
	 *
	 * @param id The row's identifier.
	 * @param options The find options the caller stated, if any.
	 * @returns The row.
	 * @throws NotFoundException when no row of the caller's scope carries the identifier.
	 */
	public async findOneByIdString(id: ID, options?: FindOneOptionsOf<T>): Promise<T> {
		return super.findOneByIdString(id, this.scopedFindOptions(options));
	}

	/**
	 * The fail-soft read by identifier, narrowed as {@link findOneByIdString} is.
	 *
	 * @param id The row's identifier.
	 * @param options The find options the caller stated, if any.
	 * @returns `success: false` when no row of the caller's scope carries the identifier.
	 */
	public async findOneOrFailByIdString(id: string, options?: FindOneOptionsOf<T>): Promise<ITryRequest<T>> {
		return super.findOneOrFailByIdString(id, this.scopedFindOptions(options));
	}

	/**
	 * Withdraws a row of the caller's own tenant and organization, recoverably.
	 *
	 * The scope is handed to the base as find options rather than checked beside it, because the base uses
	 * those options twice on the MikroORM branch — for the existence check and for the lookup of the entity
	 * it then removes — so both reads are narrowed, not only the first.
	 *
	 * @param id The row's identifier.
	 * @param options The find options the caller stated; the inherited route hands over an empty array.
	 * @param saveOptions The save options, on the TypeORM branch.
	 * @returns The withdrawn row.
	 * @throws NotFoundException when no row of the caller's scope carries the identifier.
	 */
	public async softRemove(id: ID, options?: FindOneOptionsOf<T>, saveOptions?: SaveOptions): Promise<T> {
		return super.softRemove(id, this.scopedFindOptions(options), saveOptions);
	}

	/**
	 * Restores a withdrawn row of the caller's own tenant and organization.
	 *
	 * The base adds the `withDeleted` visibility the row needs; the scope travels beside it, into the same
	 * two reads {@link softRemove} describes.
	 *
	 * @param id The row's identifier.
	 * @param options The find options the caller stated; the inherited route hands over an empty array.
	 * @param saveOptions The save options, on the TypeORM branch.
	 * @returns The restored row.
	 * @throws NotFoundException when no row of the caller's scope carries the identifier.
	 */
	public async softRecover(id: ID, options?: FindOneOptionsOf<T>, saveOptions?: SaveOptions): Promise<T> {
		return super.softRecover(id, this.scopedFindOptions(options), saveOptions);
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

	/**
	 * The find options a caller stated, with {@link readScope} merged into their `where`.
	 *
	 * The scope is spread last, so a `where` that named another tenant or organization is narrowed back to
	 * the caller's rather than widening the read. A `where` stated as a list of alternatives has the scope
	 * merged into every one of them, since any alternative left without it would be the unscoped read
	 * again. Anything that is not an options object — the inherited `DELETE /:id/soft` and
	 * `PUT /:id/recover` routes hand over their rest parameter, an array — is read as "no options", which
	 * is how the base reads it too.
	 *
	 * @param options What the caller handed over as find options.
	 * @returns The same options, narrowed to the caller's scope; unchanged when there is no scope.
	 */
	private scopedFindOptions(options: unknown): FindOneOptionsOf<T> {
		const stated =
			options && typeof options === 'object' && !Array.isArray(options)
				? (options as Record<string, any>)
				: undefined;
		const scope = this.readScope;

		if (Object.keys(scope).length === 0) {
			return stated as FindOneOptionsOf<T>;
		}

		const where = stated?.where;

		return {
			...(stated ?? {}),
			where: Array.isArray(where)
				? where.map((alternative: Record<string, unknown>) => ({ ...alternative, ...scope }))
				: { ...(where ?? {}), ...scope }
		} as FindOneOptionsOf<T>;
	}
}
