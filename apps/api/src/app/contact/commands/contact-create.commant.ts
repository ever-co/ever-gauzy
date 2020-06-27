import { ICommand } from '@nestjs/cqrs';
import { ContactCreateInput as IContactCreateInput } from '@gauzy/models';

export class ContactCreateCommand implements ICommand {
	static readonly type = '[Contacts] Create Contacts';

	constructor(public readonly input: IContactCreateInput) {}
}
