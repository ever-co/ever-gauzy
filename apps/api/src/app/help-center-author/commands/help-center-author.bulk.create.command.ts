import { IHelpCenterAuthorCreate } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class ArticleAuthorsBulkCreateCommand implements ICommand {
	static readonly type = '[ArticleAuthors] Add';

	constructor(public readonly input: IHelpCenterAuthorCreate) {}
}
