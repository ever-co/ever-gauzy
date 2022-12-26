import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationProject } from '@gauzy/contracts';
import { OrganizationProjectCreateCommand } from '../organization-project.create.command';
import { OrganizationProjectService } from '../../organization-project.service';

@CommandHandler(OrganizationProjectCreateCommand)
export class OrganizationProjectCreateHandler
	implements ICommandHandler<OrganizationProjectCreateCommand> {

	constructor(
		private readonly organizationProjectService: OrganizationProjectService
	) {}

	public async execute(
		command: OrganizationProjectCreateCommand
	): Promise<IOrganizationProject> {
		try {
			const { input } = command;
			return await this.organizationProjectService.create(input);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}