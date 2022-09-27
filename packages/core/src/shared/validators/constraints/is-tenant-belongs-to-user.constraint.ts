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
	async validate(
		value: ITenant['id'] | ITenant,
		args: ValidationArguments
	) {
		if (isEmpty(value)) return true;

		if (typeof value === 'object') {
			return value.id === RequestContext.currentTenantId();
		} else if (typeof value === 'string') {
			return value === RequestContext.currentTenantId();
		} else {
			return false;
		}
	}

	/**
     * Gets default message when validation for this constraint fail.
     */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `This user is not belongs to this tenant ${JSON.stringify(value)}.`
	}
}