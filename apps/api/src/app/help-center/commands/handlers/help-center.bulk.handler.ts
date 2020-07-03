import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { HelpCenter } from '../../help-center.entity';
import { HelpCenterService } from '../../help-center.service';
import { IHelpCenter } from '@gauzy/models';
import { HelpCenterUpdateCommand } from '../help-center.bulk.command';

@CommandHandler(HelpCenterUpdateCommand)
export class HelpCenterUpdateHandler
	implements ICommandHandler<HelpCenterUpdateCommand> {
	constructor(private readonly helpCenterService: HelpCenterService) {}

	public async execute(
		command: HelpCenterUpdateCommand
	): Promise<HelpCenter[]> {
		const { oldChildren, newChildren } = command;
		const updateInput: IHelpCenter[] = await this.helpCenterService.getAllNodes();
		for (let i = 0; i < oldChildren.length; i++) {
			updateInput.forEach(async (node) => {
				if (oldChildren[i].id === node.id) {
					await this.helpCenterService.update(node.id, {
						index: i
					});
				}
			});
		}
		const diffArray = this.diff(oldChildren, newChildren);
		if (diffArray.length !== 0)
			for (let i = 0; i < newChildren.length; i++) {
				updateInput.forEach(async (node) => {
					if (newChildren[i].id === node.id) {
						await this.helpCenterService.update(node.id, {
							index: i
						});
					}
				});
			}
		return await this.helpCenterService.updateBulk(updateInput);
	}
	diff = function (oldChildren, newChildren) {
		return oldChildren
			.filter((i) => !newChildren.includes(i))
			.concat(newChildren.filter((i) => !oldChildren.includes(i)));
	};
}
