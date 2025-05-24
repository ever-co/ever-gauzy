import { Injectable } from '@nestjs/common';
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
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
		if (isEmpty(value)) {
			return true;
		}

		const organizationId = typeof value === 'string' ? value : value.id;

		// Use the consolidated ORM logic function
		return this.checkOrganizationExistence(organizationId);
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

		if (!tenantId || !userId) {
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
