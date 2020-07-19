import { ICommand } from '@nestjs/cqrs';
import { IHelpCenter } from '@gauzy/models';

export class HelpCenterUpdateCommand implements ICommand {
	static readonly type = '[HelpCenter] Update';

	constructor(
		public readonly oldChildren: IHelpCenter[],
		public readonly newChildren: IHelpCenter[]
	) {}
}
