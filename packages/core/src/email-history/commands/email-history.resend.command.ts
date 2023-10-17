import { IResendEmailInput, LanguagesEnum } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class EmailHistoryResendCommand implements ICommand {
	static readonly type = '[Email History] Resend';

	constructor(
		public readonly input: IResendEmailInput,
		public readonly languageCode: LanguagesEnum
	) { }
}
