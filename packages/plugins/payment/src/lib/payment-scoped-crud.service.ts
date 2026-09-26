import { DeleteResult, FindOptionsWhere, SaveOptions } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { assertCriteriaHasPredicate, BaseEntity, CrudService, LegacyFindOneOptions, RequestContext } from '@gauzy/core';

/**
 * The CRUD base of the payment services that keep their own tables: the provider registry, the
 * collections, the sessions, the captures, the refunds, their reasons, their breakdown lines and the
 * inbound callback log.
 *
 * Those eight services extend the kernel's plain `CrudService` rather than `TenantAwareCrudService`,
 * and each of them scopes every read it writes itself through {@link scope}. What none of them scoped
 * was the pair it inherits. `CrudService.softRemove` and `CrudService.softRecover` resolve their row
 * through `CrudService.findOneByIdString`, which filters on the identifier alone — the kernel's own
 * comment on `softRemove` says the tenant comes from `TenantAwareCrudService`'s override of that read,
 * and these services do not inherit it. So `DELETE /:id/soft` and `PUT /:id/recover` on all eight
 * resources, and the GraphQL `softDelete*` and `recover*` fields that mirror them, retired, restored and
 * answered with a row of **any** tenant whose identifier the caller knew — a session, a capture or a
 * refund of another company, with its amount, its currency and its provider in the payload. The
 * inherited `delete` was open the same way, and worse: `DELETE /:id` erased another tenant's row for
 * good (see {@link delete}).
 *
 * The scope is merged into the find options here, once, rather than into eight copies of the same two
 * overrides. It is merged into the options rather than checked beside them because the kernel reads
 * the row twice on the MikroORM branch — a guard read through `findOneByIdString`, then the repository
 * read whose entity it removes — and both reads build their criterion from the same options, so one
 * merge scopes both reads on both ORMs. `softRecover` keeps `withDeleted`: the kernel adds it to the
 * options it is handed, after this merge, so the row being restored is still visible to the read that
 * restores it.
 *
 * **The scope is spread last, so a caller's criterion can narrow it and never widen it.** A `where`
 * that names another tenant is overwritten rather than honoured, and the read then finds nothing and
 * answers `404`, which is what a row outside the caller's scope is.
 *
 * **It fails closed.** Without a signed-in user both members are `null`, which the platform's
 * connection settings turn into `IS NULL` on TypeORM (`TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR`) and
 * which MikroORM reads the same way, so a call outside a request matches no payment row — every one of
 * them carries both columns — rather than every row.
 */
export abstract class PaymentScopedCrudService<T extends BaseEntity> extends CrudService<T> {
	/**
	 * The tenant and organization of the caller, which every query in these services is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Retires a row recoverably, provided it belongs to the caller's tenant and organization.
	 *
	 * @param id The row to retire.
	 * @param options Find options to narrow the lookup with. The inherited route hands over its rest
	 * parameter, an array, which is read as "no options" exactly as the kernel reads it.
	 * @param saveOptions The kernel's save options, forwarded unchanged.
	 * @returns The retired row.
	 * @throws NotFoundException when the row does not exist inside the caller's scope.
	 */
	public async softRemove(id: ID, options?: LegacyFindOneOptions<T>, saveOptions?: SaveOptions): Promise<T> {
		return super.softRemove(id, this.withinScope(options), saveOptions);
	}

	/**
	 * Restores a row that was retired recoverably, provided it belongs to the caller's tenant and
	 * organization.
	 *
	 * @param id The row to restore.
	 * @param options Find options to narrow the lookup with, read as {@link softRemove} reads them.
	 * @param saveOptions The kernel's save options, forwarded unchanged.
	 * @returns The restored row.
	 * @throws NotFoundException when no retired row with that identifier exists inside the caller's scope.
	 */
	public async softRecover(id: ID, options?: LegacyFindOneOptions<T>, saveOptions?: SaveOptions): Promise<T> {
		return super.softRecover(id, this.withinScope(options), saveOptions);
	}

	/**
	 * Deletes rows for good, provided they belong to the caller's tenant and organization.
	 *
	 * The same gap as the soft-delete pair, one step worse. `DELETE /:id` on the provider registry, the
	 * collections, the refunds, their reasons and the callback log hands the identifier to the kernel's
	 * `CrudService.delete`, which issues `DELETE … WHERE id = ?` on TypeORM and a `nativeDelete({ id })`
	 * on MikroORM with nothing else in the criterion — so a caller who knew the identifier of another
	 * tenant's row erased it outright. The scope is merged into the criterion here, last, so the statement
	 * the kernel issues can only ever reach the caller's own rows, on both ORMs.
	 *
	 * **The criterion must select on its own before the scope is added.** The kernel refuses a criterion
	 * with no usable predicate, but it would judge the merged one — and the scope alone is a predicate — so
	 * `delete({ refundId: undefined })` would pass as "every row of the organization". The caller's own
	 * criterion is judged first, exactly as `TenantAwareCrudService.delete` judges it.
	 *
	 * A row outside the scope is not reported as an error, just as `TenantAwareCrudService.delete` does not
	 * report one: the statement matches nothing and says that nothing was affected, and nothing of the
	 * other tenant's row — not even whether it exists — reaches the caller.
	 *
	 * @param criteria The row's identifier, or a criterion over the table.
	 * @returns The kernel's delete result: how many of the caller's rows were deleted.
	 * @throws BadRequestException when the criterion selects nothing on its own.
	 */
	public async delete(criteria: string | number | FindOptionsWhere<T>): Promise<DeleteResult> {
		const stated = (
			criteria !== null && typeof criteria === 'object' ? { ...criteria } : { id: criteria }
		) as FindOptionsWhere<T>;

		assertCriteriaHasPredicate(stated, 'delete');

		return super.delete({ ...stated, ...this.scope } as FindOptionsWhere<T>);
	}

	/**
	 * The find options of a lifecycle call, with the caller's scope merged into their criterion.
	 *
	 * @param options The options as received: an options object, nothing, or the inherited route's
	 * rest-parameter array.
	 * @returns Options whose `where` carries the caller's tenant and organization, stated last.
	 */
	protected withinScope(options?: unknown): LegacyFindOneOptions<T> {
		// `CrudController` forwards its `...options` rest parameter, which Nest fills with an empty array:
		// that is no options at all, and spreading it would add index keys rather than find options.
		const stated = (
			options && typeof options === 'object' && !Array.isArray(options) ? options : {}
		) as LegacyFindOneOptions<T>;

		// Cast through `unknown`: `FindOptionsWhere<T>` cannot name the two scope columns of an unconstrained
		// `T`, although every entity these services are built over carries both.
		return {
			...stated,
			where: { ...((stated.where as object) ?? {}), ...this.scope }
		} as unknown as LegacyFindOneOptions<T>;
	}
}
