import { Injectable } from "@nestjs/common";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { isEmpty } from "underscore";
import { ITenant } from "@gauzy/contracts";
import { RequestContext } from "../../../core/context";

/**
 * Validates whether the specified tenant belongs to the current user.
 *
 */
@ValidatorConstraint({ name: "IsTenantBelongsToUser", async: true })
@Injectable()
export class TenantBelongsToUserConstraint implements ValidatorConstraintInterface {

	/**
	 * Validates whether the specified tenant belongs to the current user.
	 *
	 * @param value - The tenant ID or tenant object to be validated.
	 * @returns A boolean indicating whether the specified tenant belongs to the current user.
	 */
	async validate(value: ITenant['id'] | ITenant): Promise<boolean> {
		if (isEmpty(value)) return true;

		const currentTenantId = RequestContext.currentTenantId();

		// Combining both conditions into one line for brevity
		return typeof value === 'string' ? value === currentTenantId : value.id === currentTenantId;
	}

	/**
	 * Gets the default message when validation for the "IsTenantBelongsToUser" constraint fails.
	 *
	 * @param validationArguments - Validation arguments.
	 * @returns The default error message.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `The user is not associated with the requested tenant. Received tenant details: ${JSON.stringify(value)}`;
	}
}
