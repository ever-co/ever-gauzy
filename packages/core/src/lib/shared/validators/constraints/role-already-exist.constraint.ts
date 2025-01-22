import { Injectable } from '@nestjs/common';
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from '../../../core/context/request-context';
import { MultiORM, MultiORMEnum, getORMType } from '../../../core/utils';
import { TypeOrmRoleRepository } from '../../../role/repository/type-orm-role.repository';
import { MikroOrmRoleRepository } from '../../../role/repository/mikro-orm-role.repository';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * Role already existed validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: 'IsRoleAlreadyExist', async: true })
@Injectable()
export class RoleAlreadyExistConstraint implements ValidatorConstraintInterface {
	constructor(
		readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		readonly mikroOrmRoleRepository: MikroOrmRoleRepository
	) {}

	/**
	 * Validates if a role with the given name does not exist for the current tenant.
	 *
	 * @param name - The name of the role to validate.
	 * @returns True if the role does not exist (passes validation), false otherwise.
	 */
	async validate(name: string): Promise<boolean> {
		if (isEmpty(name)) return true;

		const tenantId: string = RequestContext.currentTenantId();
		try {
			switch (ormType) {
				case MultiORMEnum.MikroORM:
					return !(await this.mikroOrmRoleRepository.findOneOrFail({ name, tenantId }));
				case MultiORMEnum.TypeORM:
					return !(await this.typeOrmRoleRepository.findOneByOrFail({ name, tenantId }));
				default:
					throw new Error(`Not implemented for ${ormType}`);
			}
		} catch (error) {
			// Check the specific error type (e.g., EntityNotFoundError) to ensure the error is due to the role not being found
			// Consider logging or handling other types of errors if necessary
			return true; // If the role is not found, validation passes
		}
	}

	/**
	 * Gets default message when validation for this constraint fail.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `The role name '${value}' is already in use. Please choose a unique name for the new role.`;
	}
}
