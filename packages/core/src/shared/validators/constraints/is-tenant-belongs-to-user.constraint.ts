import { Injectable } from "@nestjs/common";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { ITenant } from "@gauzy/contracts";
import { isEmpty } from "underscore";
import { RequestContext } from "./../../../core/context";

@ValidatorConstraint({ name: "IsTenantBelongsToUser", async: true })
@Injectable()
export class IsTenantBelongsToUserConstraint implements ValidatorConstraintInterface {

	/**
	 * Method to be called to perform custom validation over given value.
	 */
	async validate(value: ITenant['id'] | ITenant, args: ValidationArguments) {
		if (isEmpty(value)) return true;

		const currentTenantId = RequestContext.currentTenantId();

		if (typeof value === 'object' && 'id' in value) {
			return value.id === currentTenantId;
		} else if (typeof value === 'string') {
			return value === currentTenantId;
		}

		return false;
	}

	/**
	 * Gets default message when validation for this constraint fail.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `The user does not belong to the specified tenant. Received: ${JSON.stringify(value)}.`;
	}
}
