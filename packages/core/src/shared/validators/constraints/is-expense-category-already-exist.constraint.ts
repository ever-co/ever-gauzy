import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { ExpenseCategory } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";

/**
 * Role already existed validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: "IsExpenseCategoryAlreadyExist", async: true })
export class IsExpenseCategoryAlreadyExistConstraint
	implements ValidatorConstraintInterface {

	constructor(
        @InjectRepository(ExpenseCategory)
		private readonly repository: Repository<ExpenseCategory>
    ) {}

	/**
	 * Method to be called to perform custom validation over given value.
	 */
	async validate(name: any, args: ValidationArguments): Promise<boolean> {
		const obejct: object = args.object;
		try {
			if (obejct['organizationId'] || obejct['organization']['id']) {
				const organizationId = obejct['organizationId'] || obejct['organization']['id'];
				return !(await this.repository.findOneByOrFail({
					name,
					organizationId,
					tenantId: RequestContext.currentTenantId()
				}));
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
		return `Expense category ${value} already exists.`;
	}
}
