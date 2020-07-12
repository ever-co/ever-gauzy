import {
	LanguagesEnum,
	IOrganizationClientAcceptInviteInput
} from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class InviteAcceptOrganizationClientCommand implements ICommand {
	static readonly type = '[Invite] Accept Organziation Client';

	constructor(
		public readonly input: IOrganizationClientAcceptInviteInput,
		public readonly languageCode: LanguagesEnum
	) {}
}
