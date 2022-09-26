import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { IOrganization } from "@gauzy/contracts";
import { UserOrganization } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";

@ValidatorConstraint({ name: "IsOrganizationShouldExist", async: true })
@Injectable()
export class IsOrganizationShouldBelongsToConstraint implements ValidatorConstraintInterface {
	constructor(
        @InjectRepository(UserOrganization)
		private readonly repository: Repository<UserOrganization>
    ) {}

	/**
     * Method to be called to perform custom validation over given value.
     */
	async validate(
		organization: IOrganization['id'] | IOrganization,
		args: ValidationArguments
	) {
		if (!organization) { return false; }

		let organizationId: string;
		if (typeof(organization) === 'string') {
			organizationId = organization;
		} else if (typeof(organization) == 'object') {
			organizationId = organization.id
		}
		if (!organizationId) {
			return false;
		}

		try {
            return !!await this.repository.findOneByOrFail({
				tenantId: RequestContext.currentTenantId(),
				userId: RequestContext.currentUserId(),
				organizationId: organizationId
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
		return `This user is not belongs to this organization ${value}.`;
	}
}