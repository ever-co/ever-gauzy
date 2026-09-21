import { Injectable } from '@nestjs/common';
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { IRole } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { MultiORM, MultiORMEnum, getORMType } from '../../../core/utils';
import { TypeOrmRoleRepository } from '../../../role/repository/type-orm-role.repository';
import { MikroOrmRoleRepository } from '../../../role/repository/mikro-orm-role.repository';
import { resolveRoleReference } from '../../../user/role-assignment.helper';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * Role should existed validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: 'IsRoleShouldExist', async: true })
@Injectable()
export class RoleShouldExistConstraint implements ValidatorConstraintInterface {
	constructor(
		readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		readonly mikroOrmRoleRepository: MikroOrmRoleRepository
	) {}

	/**
	 * Validates if the given role exists for the current tenant.
	 *
	 * @param role - The role to validate, either as a string ID or an IRole object.
	 * @returns True if the role exists, false otherwise.
	 */
	async validate(role: string | IRole): Promise<boolean> {
		// The same allowlisted reading the services use (GHSA-x4mv-fhwj-g3rp): an id string or an object
		// with a non-empty string `id`. Anything else (a number, an array, `{ id: 42 }`) is not a role.
		const roleId = resolveRoleReference(role);
		if (!roleId) return false;

		const tenantId = RequestContext.currentTenantId();

		// Reject validation when there is no tenant context.
		if (!tenantId) {
			return false;
		}

		try {
			switch (ormType) {
				case MultiORMEnum.MikroORM:
					return !!(await this.mikroOrmRoleRepository.findOneOrFail({ id: roleId, tenantId }));
				case MultiORMEnum.TypeORM:
					return !!(await this.typeOrmRoleRepository.findOneByOrFail({ id: roleId, tenantId }));
				default:
					throw new Error(`Not implemented for ${ormType}`);
			}
		} catch (error) {
			return false; // Role does not exist
		}
	}

	/**
	 * Gets default message when validation for this constraint fail.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `Please provide a valid value for the role. The value '${JSON.stringify(
			value
		)}' is not recognized as a valid role identifier.`;
	}
}
