import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ExpenseCategoryCreateCommand } from './../expense-category-create.command';
import { ExpenseCategoriesService } from './../../expense-categories.service';

@CommandHandler(ExpenseCategoryCreateCommand)
export class ExpenseCategoryCreateHandler
	implements ICommandHandler<ExpenseCategoryCreateCommand> {

	constructor(
		private readonly _expenseCategoryService : ExpenseCategoriesService
	) {}

	public async execute(
		command: ExpenseCategoryCreateCommand
	) {
		const { input } = command;
		try {
			return await this._expenseCategoryService.create(input);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
