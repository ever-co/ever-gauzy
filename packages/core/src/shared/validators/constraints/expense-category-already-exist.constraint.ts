import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { Not } from "typeorm";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { ExpenseCategory } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";
import { TypeOrmExpenseCategoryRepository } from "../../../expense-categories/repository/type-orm-expense-category.repository";
import { MikroOrmExpenseCategoryRepository } from "../../../expense-categories/repository/mikro-orm-expense-category.repository";

/**
 * Expense category already existed validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: "IsExpenseCategoryAlreadyExist", async: true })
@Injectable()
export class ExpenseCategoryAlreadyExistConstraint implements ValidatorConstraintInterface {

	constructor(
		@InjectRepository(ExpenseCategory)
		readonly typeOrmExpenseCategoryRepository: TypeOrmExpenseCategoryRepository,

		readonly mikroOrmExpenseCategoryRepository: MikroOrmExpenseCategoryRepository
	) { }

	/**
	 * Method to be called to perform custom validation over given value.
	 */
	async validate(name: any, args: ValidationArguments): Promise<boolean> {
		const object: object = args.object;
		try {
			if (object['organizationId'] || object['organization']['id']) {
				const organizationId = object['organizationId'] || object['organization']['id'];
				if (args.targetName === 'UpdateExpenseCategoryDTO') {
					if (object['id']) {
						return !(await this.typeOrmExpenseCategoryRepository.findOneByOrFail({
							id: Not(object['id']),
							name,
							organizationId,
							tenantId: RequestContext.currentTenantId()
						}));
					}
					return true;
				} else {
					return !(await this.typeOrmExpenseCategoryRepository.findOneByOrFail({
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
		return `${value} already exists, please enter another category.`;
	}
}
