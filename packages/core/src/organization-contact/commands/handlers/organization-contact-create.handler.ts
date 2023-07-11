import { IEmployee, IOrganizationContact, IOrganizationProject } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { isEmpty } from '@gauzy/common';
import { In } from 'typeorm';
import { OrganizationContactCreateCommand } from '../organization-contact-create.command';
import { OrganizationContactService } from '../../organization-contact.service';
import { OrganizationProjectService } from './../../../organization-project/organization-project.service';
import { RequestContext } from './../../../core/context';

@CommandHandler(OrganizationContactCreateCommand)
export class OrganizationContactCreateHandler implements ICommandHandler<OrganizationContactCreateCommand> {

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectService: OrganizationProjectService
	) { }

	public async execute(
		command: OrganizationContactCreateCommand
	): Promise<IOrganizationContact> {
		try {
			const { input } = command;

			const tenantId = RequestContext.currentTenantId();
			const { organizationId } = input;

			/**
			 * If members is not selected, but project already has members
			 */
			if (isEmpty(input.members)) {
				if (input.projects) {
					const projectIds = input.projects.map((project: IOrganizationProject) => project.id);
					const projects = await this.organizationProjectService.find({
						where: {
							id: In(projectIds),
							organizationId,
							tenantId
						},
						relations: {
							members: true
						}
					});
					const members: IEmployee[][] = projects.map((project: IOrganizationProject) => project.members);
					input.members = [].concat(...members);
				}
			}

			return await this.organizationContactService.create(input);
		} catch (error) {
			console.log('Error while creating new organization contact', error);
		}
	}
}
