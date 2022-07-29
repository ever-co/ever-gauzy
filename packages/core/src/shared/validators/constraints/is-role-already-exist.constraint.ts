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
