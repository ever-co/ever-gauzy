import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
/**
 * Imported from its own module rather than from the `shared/handlers` barrel, and that is load-bearing.
 *
 * The barrel re-exports four handlers, the `shared` tree re-exports through `shared/index.ts`, and that reaches
 * `core/index.ts` — which re-exports `core.module`, which imports the GraphQL module, which imports every domain
 * module including this one. So a suite that entered the graph here got a partially initialised barrel back,
 * `UpdateEntityByMembersHandler` was `undefined`, and the failure is
 * `TypeError: Class extends value undefined is not a constructor or null` at the line below — taking the whole
 * suite with it, thirty-two of them in one run. The class's own module has no such cycle, so naming it directly
 * is what breaks it.
 */
import { UpdateEntityByMembersHandler } from '../../../shared/handlers/update-entity.by-member.handler';
import { OrganizationContactService } from '../../organization-contact.service';
import { OrganizationContactEditByEmployeeCommand } from '../organization-contact.edit-by-employee.command';

@CommandHandler(OrganizationContactEditByEmployeeCommand)
export class OrganizationContactEditByEmployeeHandler extends UpdateEntityByMembersHandler
	implements ICommandHandler<OrganizationContactEditByEmployeeCommand> {

	constructor(readonly organizationContactService: OrganizationContactService) {
		super(organizationContactService);
	}

	/**
	 * Executes the organization contact edit command by an employee.
	 *
	 * @param command - The command containing the input for editing the organization contact.
	 * @returns A promise that resolves with the result of the command execution.
	 */
	public async execute(
		command: OrganizationContactEditByEmployeeCommand
	): Promise<any> {
		// Extract the input from the command and execute the command logic
		return this.executeCommand(command.input);
	}
}
