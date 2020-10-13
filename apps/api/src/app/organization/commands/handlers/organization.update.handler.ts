import { IOrganization, IOrganizationUpdateInput } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationService } from '../../organization.service';
import { OrganizationUpdateCommand } from '../organization.update.command';

@CommandHandler(OrganizationUpdateCommand)
export class OrganizationUpdateHandler
	implements ICommandHandler<OrganizationUpdateCommand> {
	constructor(private readonly organizationService: OrganizationService) {}

	public async execute(
		command: OrganizationUpdateCommand
	): Promise<IOrganization> {
		const { input } = command;
		const { gauzyId } = input;

		return this.updateOrganization(gauzyId, input);
	}

	private async updateOrganization(
		id: string,
		input: IOrganizationUpdateInput
	): Promise<IOrganization> {
		const organization: IOrganization = await this.organizationService.findOne(
			id
		);
		if (organization) {
			delete input.gauzyId;

			const request = {
				...input,
				show_profits: false,
				show_bonuses_paid: false,
				show_income: false,
				show_total_hours: false,
				show_projects_count: true,
				show_minimum_project_size: true,
				show_clients_count: true,
				show_clients: true,
				show_employees_count: true
			};

			await this.organizationService.update(id, request);
			return await this.organizationService.findOne(id);
		}
	}
}
