import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IPartialEntity } from './../core/crud/icrud.service';
import { isForeignKeyViolation } from './../core/errors';
import { sanitizeRichHtml } from './../core/html-sanitizer';
import { LegacyFindOneOptions } from './../core/utils';
import { Organization } from './organization.entity';
import { countOrganizationContents, IOrganizationCounts } from './organization-counts';
import {
	hideOrganization,
	ORGANIZATION_DELETE_REFUSED,
	ORGANIZATION_DELETE_REFUSED_MESSAGE,
	restoreOrganization
} from './organization-deletion';
import { TypeOrmOrganizationRepository } from './repository/type-orm-organization.repository';
import { MikroOrmOrganizationRepository } from './repository/mikro-orm-organization.repository';

@Injectable()
export class OrganizationService extends TenantAwareCrudService<Organization> {
	constructor(
		readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		readonly mikroOrmOrganizationRepository: MikroOrmOrganizationRepository
	) {
		super(typeOrmOrganizationRepository, mikroOrmOrganizationRepository);
	}

	/**
	 * Creates (or, via the organization update command handler, upserts) an organization,
	 * sanitizing the rich-text `overview` HTML through the shared server-side allowlist before
	 * persisting. `Organization.overview` is rendered with raw `[innerHTML]` on the PUBLIC
	 * organization page, so every write path must be sanitized (see `sanitizeRichHtml`).
	 *
	 * @param entity - The organization data to persist.
	 * @returns The persisted organization.
	 */
	public async create(entity: IPartialEntity<Organization>): Promise<Organization> {
		const input = entity as { overview?: string };
		if (typeof input.overview === 'string') {
			input.overview = sanitizeRichHtml(input.overview);
		}
		return await super.create(entity);
	}

	/**
	 * Soft deletes an organization of the caller's tenant, and with it what a person meets it through: its teams
	 * leave sign-in, the workspace pick and every team list, its members' last and default organization move to
	 * another of theirs (or to none), and a token that names it is refused at its next call. Its projects, time and
	 * invoices stay untouched; {@link softRecover} brings everything back (see `organization-deletion.ts`).
	 *
	 * One transaction, through the TypeORM data source under either ORM: both read the same tables.
	 *
	 * @param id - The organization.
	 * @returns The organization, with its `deletedAt`.
	 * @throws NotFoundException when the tenant has no such live organization.
	 * @throws ConflictException (`ORGANIZATION_LAST_OF_WORKSPACE`) when it is the workspace's last organization.
	 */
	public async softRemove(id: ID): Promise<Organization> {
		const organization = await this.findOneByIdString(id);
		const deletedAt = new Date();

		await this.typeOrmRepository.manager.transaction((manager) =>
			hideOrganization(manager, { id: organization.id, tenantId: organization.tenantId }, deletedAt)
		);

		organization.deletedAt = deletedAt;
		return organization;
	}

	/**
	 * Restores a soft-deleted organization of the caller's tenant with what its soft delete hid: its teams, team
	 * memberships, organization memberships and member records come back as they were. A member the delete left
	 * with no organization lands in it again at their next sign-in.
	 *
	 * @param id - The organization.
	 * @returns The organization.
	 * @throws NotFoundException when the tenant has no such organization, deleted or not.
	 */
	public async softRecover(id: ID): Promise<Organization> {
		const organization = await this.findOneByIdString(id, { withDeleted: true });

		await this.typeOrmRepository.manager.transaction((manager) =>
			restoreOrganization(manager, { id: organization.id, tenantId: organization.tenantId })
		);

		organization.deletedAt = null;
		return organization;
	}

	/**
	 * Deletes an organization for good, as the CRUD base does, but answers a delete the database refuses because
	 * other records still point at the organization (or at its members) with a 409 that says so, instead of the
	 * base's 404 "The record was not found". Nothing is removed in that case: the statement is rolled back.
	 *
	 * @param criteria - The organization, by id or criteria.
	 * @param options - The base's options.
	 * @returns The delete result.
	 * @throws ConflictException (`ORGANIZATION_DELETE_REFUSED`) when the database refuses the delete.
	 */
	public async delete(
		criteria: string | FindOptionsWhere<Organization>,
		options?: LegacyFindOneOptions<Organization>
	): Promise<DeleteResult> {
		try {
			return await super.delete(criteria, options);
		} catch (error) {
			const refusedByReferences = error instanceof NotFoundException && isForeignKeyViolation(error.cause);
			if (refusedByReferences) {
				throw new ConflictException({
					message: ORGANIZATION_DELETE_REFUSED_MESSAGE,
					code: ORGANIZATION_DELETE_REFUSED
				});
			}
			throw error;
		}
	}

	/**
	 * Counts what an organization of the caller's tenant holds: teams, projects, members, tracked time, invoices and
	 * estimates, for the confirmation an admin reads before deleting it.
	 *
	 * @param id - The organization.
	 * @returns The counts.
	 * @throws NotFoundException when the tenant has no such live organization.
	 */
	public async countContents(id: ID): Promise<IOrganizationCounts> {
		const organization = await this.findOneByIdString(id);

		return await countOrganizationContents(this.typeOrmRepository.manager, {
			id: organization.id,
			tenantId: organization.tenantId
		});
	}
}
