import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IHelpCenter } from '@gauzy/contracts';
import { HelpCenter } from '../../help-center.entity';
import { HelpCenterService } from '../../help-center.service';
import { HelpCenterUpdateCommand } from '../help-center.bulk.command';

@CommandHandler(HelpCenterUpdateCommand)
export class HelpCenterUpdateHandler implements ICommandHandler<HelpCenterUpdateCommand> {
	constructor(private readonly helpCenterService: HelpCenterService) {}

	public async execute(command: HelpCenterUpdateCommand): Promise<HelpCenter[]> {
		const { oldChildren, newChildren } = command;
		const updateInput: IHelpCenter[] = await this.helpCenterService.getAllNodes();

		// Update indices for old children
		for (let i = 0; i < oldChildren.length; i++) {
			await Promise.all(
				updateInput.map(async (node) => {
					if (oldChildren[i].id === node.id) {
						await this.helpCenterService.update(node.id, {
							index: i
						});
					}
				})
			);
		}

		const diffArray = this.diff(oldChildren, newChildren);

		// Update indices for new children if there are differences
		if (diffArray.length !== 0) {
			for (let i = 0; i < newChildren.length; i++) {
				await Promise.all(
					updateInput.map(async (node) => {
						if (newChildren[i].id === node.id) {
							await this.helpCenterService.update(node.id, {
								index: i
							});
						}
					})
				);
			}
		}

		// Read the nodes again: saving the snapshot taken before the updates wrote every old index back,
		// so a reorder never stuck
		return await this.helpCenterService.getAllNodes();
	}

	diff = function (oldChildren, newChildren) {
		return oldChildren
			.filter((i) => !newChildren.includes(i))
			.concat(newChildren.filter((i) => !oldChildren.includes(i)));
	};
}
