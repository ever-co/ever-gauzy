import { Injectable } from '@nestjs/common';
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { IOrganization } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common';
import { RequestContext } from '../../../core/context';
import { MultiORM, MultiORMEnum, getORMType } from '../../../core/utils';
import {
	MikroOrmUserOrganizationRepository,
	TypeOrmUserOrganizationRepository
} from '../../../user-organization/repository';

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
	async validate(value: IOrganization['id'] | IOrganization): Promise<boolean> {
		if (isEmpty(value)) {
			return true;
		}

		// 'value' can be either a string (organization ID) or an organization object.
		const organizationId: string = typeof value === 'string' ? value : value.id;

		// Use the consolidated ORM logic function
		return await this.checkOrganizationExistence(organizationId);
	}

	/**
	 * Checks if the given organization exists for the current user in the database.
	 *
	 * @param organizationId The ID of the organization.
	 * @returns {Promise<boolean>} - True if found, false otherwise.
	 */
	async checkOrganizationExistence(organizationId: string): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();

		try {
			switch (ormType) {
				case MultiORMEnum.MikroORM:
					return !!(await this.mikroOrmUserOrganizationRepository.findOneOrFail({
						tenantId,
						userId,
						organizationId
					}));
				case MultiORMEnum.TypeORM:
					return !!(await this.typeOrmUserOrganizationRepository.findOneByOrFail({
						tenantId,
						userId,
						organizationId
					}));
				default:
					throw new Error(`Not implemented for ${ormType}`);
			}
		} catch (error) {
			return false;
		}
	}

	/**
	 * Gets the default error message when the validation fails.
	 * @param validationArguments - Validation arguments containing the value.
	 * @returns {string} - Default error message.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `The user with ID ${RequestContext.currentUserId()} is not associated with the specified organization (${JSON.stringify(
			value
		)}).`;
	}
}
