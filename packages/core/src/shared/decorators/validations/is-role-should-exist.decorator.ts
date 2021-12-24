import { getConnection } from "typeorm";
import {
	registerDecorator,
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { Role } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";

/**
 * Role already existed validation constraint
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
	async validate(roleId: any, args: ValidationArguments) {
		const tenantId = RequestContext.currentTenantId();
		return !(
			await getConnection().getRepository(Role).findOne({
				where: {
					id: roleId,
					tenantId
				}
			})
		);
	}
}