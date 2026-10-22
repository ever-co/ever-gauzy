import { NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { LegacyFindOneOptions, TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';
import { requestScope } from './inventory.scope';

/**
 * The CRUD base of the inventory services: a row addressed by its identifier is a row of the request's organization.
 *
 * `TenantAwareCrudService` narrows its read by identifier to the caller's tenant only, and the routes every service
 * inherits address rows by that read — `GET /:id`, the update's pre-read, the withdraw/restore pair — while its
 * `delete(id)` runs `DELETE … WHERE id AND tenantId` with no read at all. The domain verbs load through
 * {@link requestScope}, but those inherited routes did not, so a caller of one organization could read, rewrite or
 * delete a stock alert, count, transfer, reservation or channel assignment of a sibling organization of the tenant by
 * naming its id.
 *
 * Both are narrowed here, as {@link requestScope} narrows the verbs: a row of another organization is the inherited
 * read's own miss, and a delete by identifier reads its row first. A row stored without an organization, and a
 * caller with no organization in context (the worker), are not narrowed.
 */
export abstract class InventoryCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * Reads a row of the request's organization by its identifier.
	 *
	 * @param id The row's identifier.
	 * @param options The find options the caller stated, if any.
	 * @returns The row.
	 * @throws NotFoundException when no row of the request's organization carries the identifier.
	 */
	public async findOneByIdString(id: ID, options?: LegacyFindOneOptions<T>): Promise<T> {
		const row = await super.findOneByIdString(id, options);
		const { organizationId } = requestScope();

		if (organizationId && row?.organizationId && String(row.organizationId) !== String(organizationId)) {
			throw new NotFoundException('The requested record was not found');
		}

		return row;
	}

	/**
	 * Deletes a row, reading it first when it is addressed by its identifier so a row of another organization is a
	 * miss. A withdrawn row is still found, so a hard delete can purge it.
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
