import { Contact } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ContactCreateCommand } from '../contact-create.commant';
import { ContactService } from '../../contact.service';

@CommandHandler(ContactCreateCommand)
export class ContactCreateHandler
	implements ICommandHandler<ContactCreateCommand> {
	constructor(private readonly contactService: ContactService) {}

	public async execute(command: ContactCreateCommand): Promise<Contact> {
		const { input } = command;

		return await this.contactService.create(input);
	}
}
