import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { ExpenseCategoryFirstOrCreateCommand } from './../expense-category-first-or-create.command';
import { ExpenseCategoriesService } from './../../expense-categories.service';
import { RequestContext } from '../../../core/context';
import { ExpenseCategory } from './../../../core/entities/internal';

@CommandHandler(ExpenseCategoryFirstOrCreateCommand)
export class ExpenseCategoryFirstOrCreateHandler
	implements ICommandHandler<ExpenseCategoryFirstOrCreateCommand> {
	
	constructor(
		private readonly _expenseCategoryService : ExpenseCategoriesService
	) {}

	public async execute(
		command: ExpenseCategoryFirstOrCreateCommand
	) {
		const { input } = command;
		try {
			return await this._expenseCategoryService.findOneByOptions({
				where: (query: SelectQueryBuilder<ExpenseCategory>) => {
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							const { organizationId, name } = input;
							const tenantId = RequestContext.currentTenantId();

							qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
							qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
							qb.andWhere(`"${query.alias}"."name" = :name`, { name });
						})
					);
				}
			});
		} catch (error) {
			if (error instanceof NotFoundException) {
				return await this._expenseCategoryService.create(input);
			}
		}
	}
}
