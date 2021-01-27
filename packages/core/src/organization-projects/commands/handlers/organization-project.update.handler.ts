import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationProjectUpdateCommand } from '../organization-project.update.command';
import { OrganizationProjectsService } from '../../organization-projects.service';
import {
	IOrganizationProject,
	IOrganizationProjectsUpdateInput
} from '@gauzy/contracts';

@CommandHandler(OrganizationProjectUpdateCommand)
export class OrganizationProjectUpdateHandler
	implements ICommandHandler<OrganizationProjectUpdateCommand> {
	constructor(
		private readonly _organizationProjectsService: OrganizationProjectsService
	) {}

	public async execute(
		command: OrganizationProjectUpdateCommand
	): Promise<IOrganizationProject> {
		const { input } = command;
		const { id } = input;

		return this.updateProject(id, input);
	}

	private async updateProject(
		id: string,
		request: IOrganizationProjectsUpdateInput
	): Promise<IOrganizationProject> {
		const project = await this._organizationProjectsService.findOne(id);
		if (project) {
			delete request.id;
			await this._organizationProjectsService.update(id, request);
			return await this._organizationProjectsService.findOne(id);
		}

		return project;
	}
}
