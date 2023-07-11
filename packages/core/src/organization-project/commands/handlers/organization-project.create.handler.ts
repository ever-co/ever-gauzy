import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployee, IOrganizationContact, IOrganizationProject } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common';
import { OrganizationProjectCreateCommand } from '../organization-project.create.command';
import { OrganizationProjectService } from '../../organization-project.service';
import { OrganizationContactService } from './../../../organization-contact/organization-contact.service';
import { OrganizationProjectStatusBulkCreateCommand } from './../../../tasks/statuses/commands';
import { OrganizationProjectTaskPriorityBulkCreateCommand } from './../../../tasks/priorities/commands';
import { OrganizationProjectTaskSizeBulkCreateCommand } from './../../../tasks/sizes/commands';
import { OrganizationProjectIssueTypeBulkCreateCommand } from './../../../tasks/issue-type/commands';
import { RequestContext } from './../../../core/context';

@CommandHandler(OrganizationProjectCreateCommand)
export class OrganizationProjectCreateHandler implements ICommandHandler<OrganizationProjectCreateCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _organizationProjectService: OrganizationProjectService,
		private readonly _organizationContactService: OrganizationContactService
	) { }

	public async execute(
		command: OrganizationProjectCreateCommand
	): Promise<IOrganizationProject> {
		try {
			const { input } = command;

			const tenantId = RequestContext.currentTenantId();
			const { organizationId } = input;

			/**
			 * If members is not selected, but contact already has members
			 */
			if (isEmpty(input.members)) {
				if (input.organizationContactId) {
					const organizationContactId = input.organizationContactId;
					const contacts = await this._organizationContactService.find({
						where: {
							id: organizationContactId,
							organizationId,
							tenantId
						},
						relations: {
							members: true
						}
					});
					const members: IEmployee[][] = contacts.map((contact: IOrganizationContact) => contact.members);
					input.members = [].concat(...members);
				}
			}

			const project = await this._organizationProjectService.create(
				input
			);

			// 1. Create task statuses for relative organization project.
			this._commandBus.execute(
				new OrganizationProjectStatusBulkCreateCommand(project)
			);

			// 2. Create task priorities for relative organization project.
			this._commandBus.execute(
				new OrganizationProjectTaskPriorityBulkCreateCommand(project)
			);

			// 3. Create task sizes for relative organization project.
			this._commandBus.execute(
				new OrganizationProjectTaskSizeBulkCreateCommand(project)
			);

			// 4. Create issue types for relative organization project.
			this._commandBus.execute(
				new OrganizationProjectIssueTypeBulkCreateCommand(project)
			);

			return project;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
