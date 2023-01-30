import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationProject } from '@gauzy/contracts';
import { OrganizationProjectCreateCommand } from '../organization-project.create.command';
import { OrganizationProjectService } from '../../organization-project.service';
import { OrganizationProjectStatusBulkCreateCommand } from './../../../tasks/statuses/commands';
import { OrganizationProjectTaskPriorityBulkCreateCommand } from './../../../tasks/priorities/commands';
import { OrganizationProjectTaskSizeBulkCreateCommand } from './../../../tasks/sizes/commands';

@CommandHandler(OrganizationProjectCreateCommand)
export class OrganizationProjectCreateHandler
	implements ICommandHandler<OrganizationProjectCreateCommand> {

	constructor(
		private readonly commandBus: CommandBus,
		private readonly organizationProjectService: OrganizationProjectService
	) { }

	public async execute(
		command: OrganizationProjectCreateCommand
	): Promise<IOrganizationProject> {
		try {
			const { input } = command;
			const project = await this.organizationProjectService.create(input);

			// 1. Create task statuses for relative organization project.
			await this.commandBus.execute(
				new OrganizationProjectStatusBulkCreateCommand(project)
			);

			// 2. Create task priorities for relative organization project.
			await this.commandBus.execute(
				new OrganizationProjectTaskPriorityBulkCreateCommand(project)
			);

			// 3. Create task sizes for relative organization project.
			await this.commandBus.execute(
				new OrganizationProjectTaskSizeBulkCreateCommand(project)
			);

			return project;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
