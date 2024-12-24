import { Injectable } from '@nestjs/common';
import { ILike, Not } from 'typeorm';
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { RequestContext } from '../../../core/context';
import { MultiORM, MultiORMEnum, getORMType } from '../../../core/utils';
import {
	MikroOrmExpenseCategoryRepository,
	TypeOrmExpenseCategoryRepository
} from '../../../expense-categories/repository';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * Expense category already existed validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: 'IsExpenseCategoryAlreadyExist', async: true })
@Injectable()
export class ExpenseCategoryAlreadyExistConstraint implements ValidatorConstraintInterface {
	constructor(
		readonly typeOrmExpenseCategoryRepository: TypeOrmExpenseCategoryRepository,
		readonly mikroOrmExpenseCategoryRepository: MikroOrmExpenseCategoryRepository
	) {}

	/**
	 * Validates if a given name for an expense category is unique within the specified organization.
	 *
	 * @param name - The name of the expense category to validate.
	 * @param args - Validation arguments containing additional contextual information.
	 * @returns True if the name is unique (or in the case of an update, not matching any other than itself), otherwise false.
	 */
	async validate(name: string, args: ValidationArguments): Promise<boolean> {
		const object = args.object as { organizationId?: string; organization?: { id: string }; id?: string };
		const organizationId = object.organizationId || object.organization?.id;

		if (!organizationId) return true; // Validation passes if there's no organization context

		try {
			const tenantId = RequestContext.currentTenantId();

			// Convert the name to lowercase for case-insensitive comparison
			const normalizedName = name.toLowerCase();

			const queryConditions = { name: normalizedName, organizationId, tenantId };

			if (args.targetName === 'UpdateExpenseCategoryDTO' && object.id) {
				queryConditions['id'] = Not(object.id); // Exclude current category from the check
			}

			switch (ormType) {
				case MultiORMEnum.MikroORM:
					return !(await this.mikroOrmExpenseCategoryRepository.findOneOrFail({
						...queryConditions,
						name: { $ilike: normalizedName }
					}));
				case MultiORMEnum.TypeORM:
					return !(await this.typeOrmExpenseCategoryRepository.findOneByOrFail({
						...queryConditions,
						name: ILike(normalizedName)
					}));
				default:
					throw new Error(`Not implemented for ${ormType}`);
			}
		} catch (error) {
			// Consider logging or handling different types of errors explicitly
			return true; // Name doesn't exist, validation passes
		}
	}

	/**
	 * Gets default message when validation for this constraint fail.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `The category '${value}' already exists. Please choose a different name for the new category.`;
	}
}
