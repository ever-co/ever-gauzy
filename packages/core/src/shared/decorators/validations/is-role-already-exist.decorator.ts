import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
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
export const IsRoleAlreadyExist = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
        registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsRoleAlreadyExistConstraint,
		});
    };
}

@ValidatorConstraint({ name: "IsRoleAlreadyExist", async: true })
export class IsRoleAlreadyExistConstraint implements ValidatorConstraintInterface {
	constructor(
        @InjectRepository(Role)
		private readonly repository: Repository<Role>
    ) {}

	async validate(name: any, args: ValidationArguments): Promise<boolean> {
		return !(
			await this.repository.findOne({
				where: {
					name,
					tenantId: RequestContext.currentTenantId()
				}
			})
		);
	}
}
