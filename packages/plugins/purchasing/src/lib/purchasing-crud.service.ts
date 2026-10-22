import { NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	LegacyFindOneOptions,
	RequestContext,
	TenantAwareCrudService,
	TenantOrganizationBaseEntity
} from '@gauzy/core';

/**
 * The CRUD base of the purchasing services: a row addressed by its identifier, or by the conditions a caller states,
 * is a row of the request's organization.
 *
 * The purchasing operations read through `findOneScoped` and state the request's organization in their removals, but
 * `TenantAwareCrudService` narrows its reads by identifier and by conditions to the caller's tenant only, and the
 * routes every service inherits address rows through them — `GET /:id` (order lines, receipt lines), the update's
 * pre-read (receipts and their lines), the restore — while its `delete(id)` runs `DELETE … WHERE id AND tenantId`
 * with no read at all. A caller of one organization could therefore read another organization's purchase-order and
 * receipt lines, rewrite its goods receipts and their lines, and restore its purchase orders, receipts and vendor
 * terms by naming their ids.
 *
 * Both reads answer a row of another organization as their own miss, and a delete by identifier reads its row first.
 * A row stored without an organization, and a caller with no organization in context (a job), are not narrowed.
 */
export abstract class PurchasingCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * Reads a row of the request's organization by its identifier.
	 *
	 * @param id The row's identifier.
	 * @param options The find options the caller stated, if any.
	 * @returns The row.
	 * @throws NotFoundException when no row of the request's organization carries the identifier.
	 */
	public async findOneByIdString(id: ID, options?: LegacyFindOneOptions<T>): Promise<T> {
		return this.inCallerOrganization(await super.findOneByIdString(id, options));
	}

	/**
	 * Reads a row of the request's organization by the conditions stated.
	 *
	 * @param options The conditions.
	 * @returns The row.
	 * @throws NotFoundException when no row of the request's organization matches.
	 */
	public async findOneByWhereOptions(options: FindOptionsWhere<T>): Promise<T> {
		return this.inCallerOrganization(await super.findOneByWhereOptions(options));
	}

	/**
	 * Deletes a row, reading it first when it is addressed by its identifier so a row of another organization is a
	 * miss. A withdrawn row is still found, so a hard delete can purge it.
	 *
	 * A miss removes nothing and answers `affected: 0`, the count the inherited statement reported for an identifier
	 * that names no row of the caller's.
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
			try {
				await this.findOneByIdString(criteria, { withDeleted: true } as LegacyFindOneOptions<T>);
			} catch (error) {
				if (error instanceof NotFoundException) {
					return { affected: 0, raw: [] } as DeleteResult;
				}
				throw error;
			}
		}

		return super.delete(criteria, options);
	}

	/**
	 * @param row The row a tenant-scoped read found.
	 * @returns The row, when it belongs to the request's organization, to none, or the request states none.
	 * @throws NotFoundException the read's own miss, when the row belongs to another organization.
	 */
	private inCallerOrganization(row: T): T {
		const organizationId = RequestContext.currentOrganizationId();

		if (organizationId && row?.organizationId && String(row.organizationId) !== String(organizationId)) {
			throw new NotFoundException('The requested record was not found');
		}

		return row;
	}
}
