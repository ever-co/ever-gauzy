import { Injectable } from '@nestjs/common';
import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ID, IOrganization } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from '../../../core/context';
import { MultiORM, MultiORMEnum, getORMType } from '../../../core/utils';
import { TypeOrmUserOrganizationRepository } from '../../../user-organization/repository/type-orm-user-organization.repository';
import { MikroOrmUserOrganizationRepository } from '../../../user-organization/repository/mikro-orm-user-organization.repository';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * Validator constraint for checking if a user belongs to the organization.
 */
@ValidatorConstraint({ name: 'IsOrganizationBelongsToUser', async: true })
@Injectable()
export class OrganizationBelongsToUserConstraint implements ValidatorConstraintInterface {
	constructor(
		readonly typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,
		readonly mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository
	) {}

	/**
	 * Validates if the user belongs to the organization.
	 *
	 * @param value - The organization ID or organization object.
	 * @returns {Promise<boolean>} - True if the user belongs to the organization, otherwise false.
	 */
	async validate(value: ID | IOrganization): Promise<boolean> {
		// An organization OBJECT must name the organization it refers to. This runs before the
		// `isEmpty` early-out on purpose: `isEmpty` treats `{}`, `{ id: null }` and `{ id: '' }` as
		// empty, and a relation-filter object such as `{ isActive: true }` carries no id at all. Either
		// shape used to pass here — and, being truthy, also switched off the `organizationId` check in
		// `TenantOrganizationBaseDTO` — so the caller named no organization while still clearing the
		// membership check (GHSA-44pv-34gx-q9p4).
		if (value !== null && typeof value === 'object') {
			const { id } = value as IOrganization;
			if (typeof id !== 'string' || isEmpty(id)) {
				return false;
			}
			return this.checkOrganizationExistence(id);
		}

		// An absent organization id is left to the field's own `@IsOptional` / `@IsNotEmpty` rules.
		if (isEmpty(value)) {
			return true;
		}

		if (typeof value !== 'string') {
			return false;
		}

		// Use the consolidated ORM logic function
		return this.checkOrganizationExistence(value);
	}

	/**
	 * Checks if the given organization exists for the current user in the database.
	 *
	 * @param organizationId - The ID of the organization.
	 * @returns {Promise<boolean>} - True if found, false otherwise.
	 */
	async checkOrganizationExistence(organizationId: string): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();

		// Never issue the lookup with an empty organization id: TypeORM drops an `undefined` where key
		// (`invalidWhereValuesBehavior.undefined: 'ignore'`), and the membership check would then match
		// ANY organization the caller belongs to (GHSA-44pv-34gx-q9p4).
		if (!tenantId || !userId || !organizationId || typeof organizationId !== 'string') {
			return false;
		}

		try {
			switch (ormType) {
				case MultiORMEnum.MikroORM: {
					await this.mikroOrmUserOrganizationRepository.findOneOrFail({
						tenantId,
						userId,
						organizationId
					});
					return true;
				}
				case MultiORMEnum.TypeORM: {
					await this.typeOrmUserOrganizationRepository.findOneByOrFail({
						tenantId,
						userId,
						organizationId
					});
					return true;
				}
				default:
					throw new Error(`ORM type "${ormType}" not implemented.`);
			}
		} catch {
			return false;
		}
	}

	/**
	 * Gets the default error message when validation fails.
	 *
	 * @returns {string} - Default error message.
	 */
	defaultMessage(): string {
		const userId = RequestContext.currentUserId();
		return `The user with ID ${userId} is not associated with the specified organization.`;
	}
}
