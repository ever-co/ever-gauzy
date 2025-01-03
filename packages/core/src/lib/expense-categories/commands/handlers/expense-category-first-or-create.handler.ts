import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ExpenseCategoryFirstOrCreateCommand } from './../expense-category-first-or-create.command';
import { ExpenseCategoriesService } from './../../expense-categories.service';
import { RequestContext } from '../../../core/context';
import { ExpenseCategoryCreateCommand } from '../expense-category-create.command';

@CommandHandler(ExpenseCategoryFirstOrCreateCommand)
export class ExpenseCategoryFirstOrCreateHandler
	implements ICommandHandler<ExpenseCategoryFirstOrCreateCommand> {

	constructor(
		private readonly _expenseCategoryService : ExpenseCategoriesService,
		private readonly _commandBus: CommandBus
	) {}

	public async execute(
		command: ExpenseCategoryFirstOrCreateCommand
	) {
		const { input } = command;
		try {
			const { organizationId, name } = input;
			const tenantId = RequestContext.currentTenantId();

			return await this._expenseCategoryService.findOneByWhereOptions({
				tenantId,
				organizationId,
				name
			});
		} catch (error) {
			return await this._commandBus.execute(
				new ExpenseCategoryCreateCommand(input)
			);
		}
	}
}
