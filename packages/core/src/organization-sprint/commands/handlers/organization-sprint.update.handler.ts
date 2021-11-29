import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationSprint } from '@gauzy/contracts';
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
	): Promise<IOrganizationSprint> {
		const { id, input } = command;
		const record = await this.organizationSprintService.findOneByIdString(id);
		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}
		//This will call save() with the id so that task[] also get saved accordingly
		return this.organizationSprintService.create({
			id,
			...input
		});
	}
}
