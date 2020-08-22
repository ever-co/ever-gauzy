import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationProjectUpdateCommand } from '../organization-project.update.command';
import { OrganizationProjectsService } from '../../organization-projects.service';
import {
	OrganizationProjects,
	OrganizationProjectsUpdateInput
} from '@gauzy/models';

@CommandHandler(OrganizationProjectUpdateCommand)
export class OrganizationProjectUpdateHandler
	implements ICommandHandler<OrganizationProjectUpdateCommand> {
	constructor(
		private readonly _organizationProjectsService: OrganizationProjectsService
	) {}

	public async execute(
		command: OrganizationProjectUpdateCommand
	): Promise<OrganizationProjects> {
		const { input } = command;
		const { id } = input;

		return this.updateTask(id, input);
	}

	private async updateTask(
		id: string,
		request: OrganizationProjectsUpdateInput
	): Promise<OrganizationProjects> {
		const project = await this._organizationProjectsService.findOne(id);
		if (project) {
			delete request.id;
			await this._organizationProjectsService.update(id, request);
			return await this._organizationProjectsService.findOne(id);
		}

		return project;
	}
}
