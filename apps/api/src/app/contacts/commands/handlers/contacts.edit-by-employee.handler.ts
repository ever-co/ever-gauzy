import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateEntityByMembersHandler } from '../../../shared';
import { ContactsService } from '../../contacts.service';
// import { OrganizationClientsEditByEmployeeCommand } from '../organization-clients.edit-by-employee.command';

// @CommandHandler(ContactsEditByEmployeeHandler)
// export class ContactsEditByEmployeeHandler
// 	extends UpdateEntityByMembersHandler
// 	implements ICommandHandler<ContactsEditByEmployeeCommand> {
// 	constructor(
// 		private readonly contactsService: ContactsService
// 	) {
// 		super(contactsService);
// 	}

// 	public async execute(
// 		command: ContactsEditByEmployeeCommand
// 	): Promise<any> {
// 		return this.executeCommand(command.input);
// 	}
// }
