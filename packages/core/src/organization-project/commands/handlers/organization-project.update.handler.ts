import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationProjectUpdateCommand } from '../organization-project.update.command';
import { OrganizationProjectService } from '../../organization-project.service';
import {
	IOrganizationProject,
	IOrganizationProjectsUpdateInput
} from '@gauzy/contracts';

@CommandHandler(OrganizationProjectUpdateCommand)
export class OrganizationProjectUpdateHandler
	implements ICommandHandler<OrganizationProjectUpdateCommand> {
	constructor(
		private readonly _organizationProjectService: OrganizationProjectService
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
		const project = await this._organizationProjectService.findOne(id);
		if (project) {
			delete request.id;
			await this._organizationProjectService.update(id, request);
			return await this._organizationProjectService.findOne(id);
		}

		return project;
	}
}
