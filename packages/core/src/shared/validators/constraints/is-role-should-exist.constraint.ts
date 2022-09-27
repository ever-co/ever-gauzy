import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { IRole } from "@gauzy/contracts";
import { Role } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";

/**
 * Role should existed validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: "IsRoleShouldExist", async: true })
@Injectable()
export class IsRoleShouldExistConstraint implements ValidatorConstraintInterface {
	constructor(
        @InjectRepository(Role)
		private readonly repository: Repository<Role>
    ) {}

	/**
     * Method to be called to perform custom validation over given value.
     */
	async validate(role: string | IRole, args: ValidationArguments) {
		if (!role) {
			return false;
		}

		let roleId: string;
		if (typeof(role) === 'string') {
			roleId = role;
		} else if (typeof(role) == 'object') {
			roleId = role.id
		}
		if (!roleId) {
			return false;
		}

		try {
			return !!await this.repository.findOneByOrFail({
				id: roleId,
				tenantId: RequestContext.currentTenantId()
			});
		} catch (error) {
			return false;
		}
	}

	/**
     * Gets default message when validation for this constraint fail.
     */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `Role ${value} must be a valid value.`;
	}
}