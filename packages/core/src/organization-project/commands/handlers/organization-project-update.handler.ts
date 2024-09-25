import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationProject } from '@gauzy/contracts';
import { OrganizationProjectUpdateCommand } from '../organization-project-update.command';
import { OrganizationProjectService } from '../../organization-project.service';

@CommandHandler(OrganizationProjectUpdateCommand)
export class OrganizationProjectUpdateHandler
	implements ICommandHandler<OrganizationProjectUpdateCommand> {

	constructor(
		private readonly _organizationProjectService: OrganizationProjectService
	) { }

	public async execute(
		command: OrganizationProjectUpdateCommand
	): Promise<IOrganizationProject> {
		try {
			const { input } = command;
			const { id } = input;
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			await this._organizationProjectService.create({
				...input,
				id
			});
			return await this._organizationProjectService.findOneByIdString(id);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
