import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationSprintService } from '../../organization-sprint.service';
import { OrganizationSprintUpdateCommand } from '../organization-sprint.update.command';

@CommandHandler(OrganizationSprintUpdateCommand)
export class OrganizationSprintUpdateHandler
	implements ICommandHandler<OrganizationSprintUpdateCommand> {
	constructor(
		private readonly organizationSprintService: OrganizationSprintService
	) {}

	public async execute(
		command: OrganizationSprintUpdateCommand
	): Promise<any> {
		const { id, input } = command;

		//This will call save() with the id so that task[] also get saved accordingly
		return this.organizationSprintService.create({
			id,
			...input
		});
	}
}
