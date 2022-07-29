import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
	registerDecorator,
	ValidationArguments,
	ValidationOptions,
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
export const IsRoleShouldExist = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
        registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsRoleShouldExistConstraint,
		});
    };
}

@ValidatorConstraint({ name: "IsRoleShouldExist", async: true })
export class IsRoleShouldExistConstraint implements ValidatorConstraintInterface {
	constructor(
        @InjectRepository(Role)
		private readonly repository: Repository<Role>
    ) {}

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
}