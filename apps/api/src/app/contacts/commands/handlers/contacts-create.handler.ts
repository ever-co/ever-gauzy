import { Contacts } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ContactsCreateCommand } from '../contacts-create.commant';
import { ContactsService } from '../../contacts.service';

@CommandHandler(ContactsCreateCommand)
export class ContactsCreateHandler
	implements ICommandHandler<ContactsCreateCommand> {
	constructor(private readonly contactsService: ContactsService) {}

	public async execute(command: ContactsCreateCommand): Promise<Contacts> {
		const { input } = command;

		return await this.contactsService.create(input);
	}
}
