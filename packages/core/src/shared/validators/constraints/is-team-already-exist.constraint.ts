import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { Not, Repository } from "typeorm";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { isEmpty } from "@gauzy/common";
import { OrganizationTeam } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";

/**
 * Organization team already existed validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: "IsTeamAlreadyExist", async: true })
@Injectable()
export class IsTeamAlreadyExistConstraint implements ValidatorConstraintInterface {

	constructor(
        @InjectRepository(OrganizationTeam)
		private readonly repository: Repository<OrganizationTeam>
    ) {}

	/**
	 * Method to be called to perform custom validation over given value.
	 */
	async validate(name: any, args: ValidationArguments): Promise<boolean> {
		if (isEmpty(name)) return true;

		const object: object = args.object;
		try {
			if (object['organizationId'] || object['organization']['id']) {
				const organizationId = object['organizationId'] || object['organization']['id'];
				if (object['id']) {
					return !(await this.repository.findOneByOrFail({
						id: Not(object['id']),
						name,
						organizationId,
						tenantId: RequestContext.currentTenantId()
					}));
				} else {
					return !(await this.repository.findOneByOrFail({
						name,
						organizationId,
						tenantId: RequestContext.currentTenantId()
					}));
				}
			}
			return true;
		} catch (error) {
			return true;
		}
	}

	/**
     * Gets default message when validation for this constraint fail.
     */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `team (${value}) already exists.`;
	}
}
