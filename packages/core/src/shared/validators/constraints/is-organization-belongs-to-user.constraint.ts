import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { IOrganization } from "@gauzy/contracts";
import { isEmpty } from "@gauzy/common";
import { UserOrganization } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";

@ValidatorConstraint({ name: "IsOrganizationBelongsToUser", async: true })
@Injectable()
export class IsOrganizationBelongsToUserConstraint implements ValidatorConstraintInterface {

	constructor(
        @InjectRepository(UserOrganization)
		private readonly repository: Repository<UserOrganization>
    ) {}

	/**
     * Method to be called to perform custom validation over given value.
     */
	async validate(
		value: IOrganization['id'] | IOrganization,
		args: ValidationArguments
	) {
		if (isEmpty(value)) { return true; }

		let organizationId: string;
		if (typeof(value) === 'string') {
			organizationId = value;
		} else if (typeof(value) == 'object') {
			organizationId = value.id
		}

		try {
            return !!await this.repository.findOneByOrFail({
				tenantId: RequestContext.currentTenantId(),
				userId: RequestContext.currentUserId(),
				organizationId
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
		return `This user is not belongs to this organization (${JSON.stringify(value)}).`;
	}
}