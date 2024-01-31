import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { isEmpty } from "@gauzy/common";
import { Role } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";
import { TypeOrmRoleRepository } from "../../../role/repository/type-orm-role.repository";
import { MikroOrmRoleRepository } from "../../../role/repository/mikro-orm-role.repository";

/**
 * Role already existed validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: "IsRoleAlreadyExist", async: true })
@Injectable()
export class RoleAlreadyExistConstraint implements ValidatorConstraintInterface {

	constructor(
		@InjectRepository(Role)
		readonly typeOrmRoleRepository: TypeOrmRoleRepository,

		readonly mikroOrmRoleRepository: MikroOrmRoleRepository,
	) { }

	/**
	 * Method to be called to perform custom validation over given value.
	 */
	async validate(name: any, args: ValidationArguments): Promise<boolean> {
		if (isEmpty(name)) return true;

		const tenantId = RequestContext.currentTenantId();

		try {
			await this.typeOrmRoleRepository.findOneByOrFail({ name, tenantId });
			return false; // Role exists
		} catch {
			return true; // Role does not exist
		}
	}

	/**
	 * Gets default message when validation for this constraint fail.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `The role "${value}" already exists. Please choose a different role name.`;
	}
}
