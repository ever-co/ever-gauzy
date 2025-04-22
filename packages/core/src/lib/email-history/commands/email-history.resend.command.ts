import { ICommand } from '@nestjs/cqrs';
import { ID, IResendEmailInput, LanguagesEnum } from '@gauzy/contracts';

export class EmailHistoryResendCommand implements ICommand {
	static readonly type = '[Email History] Resend';

	constructor(
		public readonly id: ID,
		public readonly input: IResendEmailInput,
		public readonly languageCode: LanguagesEnum
	) {}
}
