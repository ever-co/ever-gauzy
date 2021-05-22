import { IOrganization, IOrganizationUpdateInput } from '@gauzy/contracts';
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
		const { id } = input;
		return this.updateOrganization(id, input);
	}

	private async updateOrganization(
		id: string,
		input: IOrganizationUpdateInput
	): Promise<IOrganization> {
		const organization: IOrganization = await this.organizationService.findOne(
			id
		);
		if (organization) {
			//if any organization set as default
			const { tenantId } = organization;
			if (input.isDefault === true) {
				await this.organizationService.update({ tenantId }, {
					isDefault: false
				});
			}

			const request = {
				...input,
				show_profits: input.show_profits || false,
				show_bonuses_paid: input.show_bonuses_paid || false,
				show_income: input.show_income || false,
				show_total_hours: input.show_total_hours || false,
				show_projects_count: input.show_projects_count || true,
				show_minimum_project_size: input.show_minimum_project_size || true,
				show_clients_count: input.show_clients_count || true,
				show_clients: input.show_clients || true,
				show_employees_count: input.show_employees_count || true
			};
			await this.organizationService.create({
				id,
				...request
			});
		}
		
		return await this.organizationService.findOne(id);
	}
}
