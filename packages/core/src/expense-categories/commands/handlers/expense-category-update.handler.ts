import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ExpenseCategoryUpdateCommand } from './../expense-category-update.command';
import { ExpenseCategoriesService } from './../../expense-categories.service';

@CommandHandler(ExpenseCategoryUpdateCommand)
export class ExpenseCategoryUpdateHandler
	implements ICommandHandler<ExpenseCategoryUpdateCommand> {

	constructor(
		private readonly _expenseCategoryService : ExpenseCategoriesService
	) {}

	public async execute(
		command: ExpenseCategoryUpdateCommand
	) {
		const { id, input } = command;
		try {
			return await this._expenseCategoryService.create({
				id,
				...input
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
