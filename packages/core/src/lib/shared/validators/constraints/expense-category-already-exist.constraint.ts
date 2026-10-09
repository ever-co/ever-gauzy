import { Injectable } from '@nestjs/common';
import { Not } from 'typeorm';
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { RequestContext } from '../../../core/context';
import { MultiORM, MultiORMEnum, getORMType } from '../../../core/utils';
import { TypeOrmExpenseCategoryRepository } from '../../../expense-categories/repository/type-orm-expense-category.repository';
import { MikroOrmExpenseCategoryRepository } from '../../../expense-categories/repository/mikro-orm-expense-category.repository';

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
			const isUpdate = args.targetName === 'UpdateExpenseCategoryDTO' && !!object.id;

			// Load the organization's categories and compare names here rather than with a LIKE query:
			// LIKE treats `%` / `_` (and `\` on PostgreSQL) as pattern characters, its case folding depends on
			// the database (SQLite only folds ASCII), and `$ilike` is PostgreSQL-only in MikroORM.
			const isSameName = (category: { name?: string }) => category.name?.toLowerCase() === normalizedName;

			switch (ormType) {
				case MultiORMEnum.MikroORM: {
					// MikroORM operators (`$ne`), not TypeORM's `Not()`, which MikroORM does not understand
					const categories = await this.mikroOrmExpenseCategoryRepository.find({
						organizationId,
						tenantId,
						...(isUpdate ? { id: { $ne: object.id } } : {})
					});
					return !categories.some(isSameName);
				}
				case MultiORMEnum.TypeORM: {
					const categories = await this.typeOrmExpenseCategoryRepository.findBy({
						organizationId,
						tenantId,
						...(isUpdate ? { id: Not(object.id) } : {})
					});
					return !categories.some(isSameName);
				}
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
