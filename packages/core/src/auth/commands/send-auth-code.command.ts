import { ICommand } from '@nestjs/cqrs';
import { IUserEmailInput } from '@gauzy/contracts';

export class SendAuthCodeCommand implements ICommand {

	static readonly type = '[Password Less] Send Auth Code';

	constructor(
		public readonly input: IUserEmailInput
	) {}
}
