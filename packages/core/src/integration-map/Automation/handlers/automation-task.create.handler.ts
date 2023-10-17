import { ICommandHandler, CommandHandler, EventBus } from '@nestjs/cqrs';
import { AutomationIssueCreateCommand } from '../automation-task.create.command';

@CommandHandler(AutomationIssueCreateCommand)
export class AutomationIssueCreateCommandHandler implements ICommandHandler<AutomationIssueCreateCommand> {
	constructor(
		private readonly eventBus: EventBus
	) { }

	async execute(command: AutomationIssueCreateCommand): Promise<void> {
		const { input } = command;
		console.log(`Execution Create Automation Issue Command: ${JSON.stringify(input)}`);
	}
}
