import { ICommand } from '@nestjs/cqrs';
import { ICreateEmailInvitesInput, LanguagesEnum } from '@gauzy/contracts';

export class InviteBulkCreateCommand implements ICommand {
	static readonly type = '[Invite Bulk] Create';

	constructor(public readonly input: ICreateEmailInvitesInput, public readonly languageCode: LanguagesEnum) {}
}
