import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { LegacyFindOneOptions, TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the order services: they keep every caller inside the platform's organization boundary.
 *
 * `TenantAwareCrudService` used to narrow the order services to the caller's tenant only, and the routes every service
 * inherits address rows through it — `GET /:id`, `GET /orders/by-number/:number`, the update's pre-read, the
 * withdraw/restore pair, the change confirmation — while its `delete(id)` ran `DELETE … WHERE id AND tenantId` with no
 * read at all. A caller of one organization could therefore read another organization's orders, confirm a change that
 * rewrote another organization's order lines, and withdraw or delete its rows by naming their ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read, and no write or delete reaches it.
 */
export abstract class OrderCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the order services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}

	/**
	 * Deletes a row, reading it first when it is addressed by its identifier, so a row the caller cannot reach (or that
	 * does not exist) is answered with the read's `404` rather than an empty result. A withdrawn row is still found, so
	 * a hard delete can purge it.
	 *
	 * @param criteria The row's identifier, or the conditions it must satisfy.
	 * @param options The find options the caller stated, if any.
	 * @returns The deletion result.
	 */
	public async delete(
		criteria: string | FindOptionsWhere<T>,
		options?: LegacyFindOneOptions<T>
	): Promise<DeleteResult> {
		if (typeof criteria === 'string') {
			await this.findOneByIdString(criteria, { withDeleted: true } as LegacyFindOneOptions<T>);
		}

		return super.delete(criteria, options);
	}
}
