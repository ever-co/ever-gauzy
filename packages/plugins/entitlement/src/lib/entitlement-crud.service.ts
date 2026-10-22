import { NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	LegacyFindOneOptions,
	RequestContext,
	TenantAwareCrudService,
	TenantOrganizationBaseEntity
} from '@gauzy/core';

/**
 * The CRUD base of the entitlement services: a row addressed by its identifier, or by the conditions a caller states,
 * is a row of the request's organization.
 *
 * The entitlement operations read through `findOneScoped`, but `TenantAwareCrudService` narrows its reads by identifier
 * and by conditions to the caller's tenant only, and the routes every service inherits address rows through them — the
 * update's pre-read (activations) and the withdraw/restore pair, which every removal route of this plugin reaches (no
 * route hard-deletes a right, a key or an activation). A caller of one organization could therefore rewrite another
 * organization's activations, and withdraw and restore its entitlements, keys and activations by naming their ids.
 *
 * Both reads answer a row of another organization as their own miss. A row stored without an organization, and a
 * caller with no organization in context (a job), are not narrowed.
 */
export abstract class EntitlementCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
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
