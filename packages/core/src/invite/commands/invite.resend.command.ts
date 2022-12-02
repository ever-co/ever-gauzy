import { IInviteResendInput, LanguagesEnum } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class InviteResendCommand implements ICommand {
	static readonly type = '[Invite] Resend';

	constructor(
		public readonly input: IInviteResendInput,
		public readonly languageCode: LanguagesEnum
	) {}
}
