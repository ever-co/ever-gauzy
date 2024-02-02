import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { IOrganization } from "@gauzy/contracts";
import { isEmpty } from "@gauzy/common";
import { UserOrganization } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";
import { TypeOrmUserOrganizationRepository } from "../../../user-organization/repository/type-orm-user-organization.repository";
import { MikroOrmUserOrganizationRepository } from "../../../user-organization/repository/mikro-orm-user-organization.repository";

/**
 * Validator constraint for checking if a user belongs to the organization.
 */
@ValidatorConstraint({ name: "IsOrganizationBelongsToUser", async: true })
@Injectable()
export class OrganizationBelongsToUserConstraint implements ValidatorConstraintInterface {

	constructor(
		@InjectRepository(UserOrganization)
		readonly typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,

		readonly mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,
	) { }

	/**
	 * Validates if the user belongs to the organization.
	 * @param value - The value to be validated (organization ID or organization object).
	 * @param args - Validation arguments containing the object.
	 * @returns {Promise<boolean>} - True if the user belongs to the organization, otherwise false.
	 */
	async validate(value: IOrganization['id'] | IOrganization, args: ValidationArguments): Promise<boolean> {
		if (isEmpty(value)) { return true; }

		const organizationId: string = (typeof value === 'string') ? value : value.id;

		try {
			return !!await this.typeOrmUserOrganizationRepository.findOneByOrFail({
				tenantId: RequestContext.currentTenantId(),
				userId: RequestContext.currentUserId(),
				organizationId
			});
		} catch (error) {
			return false;
		}
	}

	/**
	 * Gets the default error message when the validation fails.
	 * @param validationArguments - Validation arguments containing the value.
	 * @returns {string} - Default error message.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `The user (${RequestContext.currentUserId()}) does not belong to the organization (${value}).`;
	}
}
