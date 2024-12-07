import {
	LanguagesEnum,
	IOrganizationContactAcceptInviteInput
} from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class InviteAcceptOrganizationContactCommand implements ICommand {
	static readonly type = '[Invite] Accept Organization Contact';

	constructor(
		public readonly input: IOrganizationContactAcceptInviteInput,
		public readonly languageCode: LanguagesEnum
	) {}
}
