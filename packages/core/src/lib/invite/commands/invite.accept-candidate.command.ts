import { IInviteAcceptInput, LanguagesEnum } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class InviteAcceptCandidateCommand implements ICommand {
	static readonly type = '[Invite] Accept Candidate';

	constructor(
		public readonly input: IInviteAcceptInput,
		public readonly languageCode: LanguagesEnum
	) {}
}
