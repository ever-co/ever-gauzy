import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { ExpenseCategoryFirstOrCreateCommand } from './../expense-category-first-or-create.command';
import { ExpenseCategoriesService } from './../../expense-categories.service';
import { RequestContext } from '../../../core/context';

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

		const { organizationId, name } = input;
		const tenantId = RequestContext.currentTenantId();

		try {
			return await this._expenseCategoryService.findOneByWhereOptions({
				tenantId,
				organizationId,
				name
			});
		} catch (error) {
			if (error instanceof NotFoundException) {
				return await this._expenseCategoryService.create(input);
			}
		}
	}
}
