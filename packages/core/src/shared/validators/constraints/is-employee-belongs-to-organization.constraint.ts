import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { IEmployee } from "@gauzy/contracts";
import { isEmpty } from "@gauzy/common";
import { Employee } from "./../../../core/entities/internal";
import { RequestContext } from "./../../../core/context";

@ValidatorConstraint({ name: "IsEmployeeBelongsToOrganization", async: true })
@Injectable()
export class IsEmployeeBelongsToOrganizationConstraint implements ValidatorConstraintInterface {

	constructor(
		@InjectRepository(Employee)
		private readonly repository: Repository<Employee>
    ) {}

	/**
     * Method to be called to perform custom validation over given value.
     */
	async validate(
		value: IEmployee['id'] | IEmployee,
		args: ValidationArguments
	) {
		if (isEmpty(value)) { return true; }

		let employeeId: string;
		if (typeof(value) === 'string') {
			employeeId = value;
		} else if (typeof(value) == 'object') {
			employeeId = value.id;
		}
		const object: object = args.object;
		try {
			if (object['organizationId'] || object['organization']['id']) {
				const organizationId = object['organizationId'] || object['organization']['id'];
				return !!await this.repository.findOneByOrFail({
					id: employeeId,
					organizationId,
					tenantId: RequestContext.currentTenantId()
				});
			}
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
     * Gets default message when validation for this constraint fail.
     */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `This employee (${JSON.stringify(value)}) is not belongs to this organization.`;
	}
}