import { ICommand } from '@nestjs/cqrs';
import { IHelpCenterArticleUpdate } from '@gauzy/contracts';

export class HelpCenterUpdateArticleCommand implements ICommand {
	static readonly type = '[Article] Update';

	constructor(
		public id: string,
		public readonly input: IHelpCenterArticleUpdate
	) { }
}
