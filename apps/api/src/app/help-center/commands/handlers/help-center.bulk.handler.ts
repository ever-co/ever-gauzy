import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HelpCenter } from '../../help-center.entity';
import { HelpCenterCreateCommand } from '../help-center.bulk.command';
import { HelpCenterService } from '../../help-center.service';
import { IHelpCenter } from '@gauzy/models';

@CommandHandler(HelpCenterCreateCommand)
export class HelpCenterCreateHandler
	implements ICommandHandler<HelpCenterCreateCommand> {
	constructor(private readonly helpCenterService: HelpCenterService) {}

	public async execute(
		command: HelpCenterCreateCommand
	): Promise<HelpCenter[]> {
		const { oldChildren, newChildren } = command;
		const updateInput: IHelpCenter[] = [];

		for (const oldChild of oldChildren) {
			updateInput.push(oldChild);
		}
		for (const newChild of newChildren) {
			updateInput.push(newChild);
		}
		return await this.helpCenterService.createBulk(updateInput);
	}
}
