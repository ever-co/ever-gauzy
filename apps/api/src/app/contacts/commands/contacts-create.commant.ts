import { ICommand } from '@nestjs/cqrs';
import { ContactsCreateInput as IContactsCreateInput } from '@gauzy/models';

export class ContactsCreateCommand implements ICommand {
	static readonly type = '[Contacts] Create Contacts';

	constructor(public readonly input: IContactsCreateInput) {}
}
