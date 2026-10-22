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
 * The CRUD base of the fulfilment services: a row addressed by its identifier, or by the conditions a caller states, is
 * a row of the request's organization.
 *
 * `TenantAwareCrudService` narrows its reads by identifier and by conditions to the caller's tenant only, and the
 * routes every service inherits address rows through them — `GET /:id`, the update's pre-read, the restore — as do the
 * shipment lifecycle writes (`ship`, `in-transit`, `deliver`, `cancel`, `label`), which then write under the
 * organization of the row they read. Its `delete(id)` runs `DELETE … WHERE id AND tenantId` with no read at all. A
 * caller of one organization could therefore read and advance another organization's shipments, rewrite and restore
 * its shipping options and profiles, and delete them by naming their ids. The shipment and shipment-line removals
 * already state the request's organization (`removalCriteria`); the reads and the other removals did not.
 *
 * Both reads answer a row of another organization as their own miss, and a delete by identifier reads its row first.
 * A row stored without an organization, and a caller with no organization in context (a job), are not narrowed.
 */
export abstract class FulfillmentCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
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
	 * Reads back a row this call has just written, wherever it was written.
	 *
	 * A create keeps an organization the request stated (REST validates it against the caller's memberships), which
	 * need not be the organization the reads above narrow to; the row the call itself wrote is answered all the same.
	 *
	 * @param id The identifier of the row the call wrote.
	 * @param options The find options the caller stated, if any.
	 * @returns The row.
	 */
	protected async findOneWritten(id: ID, options?: LegacyFindOneOptions<T>): Promise<T> {
		return super.findOneByIdString(id, options);
	}

	/**
	 * Deletes a row, reading it first when it is addressed by its identifier so a row of another organization is a
	 * miss. A withdrawn row is still found, so a hard delete can purge it.
	 *
	 * A miss removes nothing and answers `affected: 0`, as the inherited statement answered an identifier that names
	 * no row of the caller's, so the fields that answer whether a row was removed keep answering `false`.
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
