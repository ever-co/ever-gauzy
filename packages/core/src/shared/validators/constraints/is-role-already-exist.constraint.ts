import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
	ValidationArguments,
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
@ValidatorConstraint({ name: "IsRoleAlreadyExist", async: true })
export class IsRoleAlreadyExistConstraint implements ValidatorConstraintInterface {
	constructor(
        @InjectRepository(Role)
		private readonly repository: Repository<Role>
    ) {}

	/**
	 * Method to be called to perform custom validation over given value.
	 */
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

	/**
     * Gets default message when validation for this constraint fail.
     */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `Role ${value} already exists.`;
	}
}
