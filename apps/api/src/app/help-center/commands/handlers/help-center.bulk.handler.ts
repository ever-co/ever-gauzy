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
		const { oldChildren } = command;
		// let parentGeneral: IHelpCenter;
		const updateInput: IHelpCenter[] = await this.helpCenterService.getAllNodes();
		// for (let i = 0; i < oldChildren.length; i++)
		// console.log('bbbbbbb', oldChildren[i].index, oldChildren[i].id);
		// for (let i = 0; i < newChildren.length; i++)
		// console.log('aaaaaaa', newChildren[i].index, newChildren[i].id);

		for (const node of updateInput) {
			for (const oldChild of oldChildren) {
				if (node.id === oldChild.id && node.index !== oldChild.index) {
					node.index = oldChild.index;
					// console.log('oldUP', node.id, node.index);
				}
				// parentGeneral = oldChild.parent ? oldChild.parent : null;
			}
			// for (const newChild of newChildren) {
			// 	if (
			// 		(newChild.parent &&
			// 			parentGeneral &&
			// 			newChild.parent.id !== parentGeneral.id) ||
			// 		(parentGeneral === null && newChild.parent)
			// 	)
			// 		if (
			// 			node.id === newChild.id &&
			// 			node.index !== newChild.index
			// 		) {
			// 			node.index = newChild.index;
			// 			console.log('newUP', node.id, node.index);
			// 		}
			// }
		}
		return await this.helpCenterService.createBulk(updateInput);
	}
}
