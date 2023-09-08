import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganization, IOrganizationUpdateInput } from '@gauzy/contracts';
import { OrganizationService } from '../../organization.service';
import { OrganizationUpdateCommand } from '../organization.update.command';

@CommandHandler(OrganizationUpdateCommand)
export class OrganizationUpdateHandler
	implements ICommandHandler<OrganizationUpdateCommand> {

	constructor(
		private readonly organizationService: OrganizationService
	) { }

	public async execute(
		command: OrganizationUpdateCommand
	): Promise<IOrganization> {
		const { input, id } = command;
		return await this.update(id, input);
	}

	/**
	 *
	 * @param id
	 * @param input
	 * @returns
	 */
	private async update(id: IOrganization['id'], input: IOrganizationUpdateInput): Promise<IOrganization> {
		const organization: IOrganization = await this.organizationService.findOneByIdString(id);
		if (organization) {
			const { tenantId } = organization;

			//if any organization set as default
			if (input.isDefault === true) {
				await this.organizationService.update({ tenantId }, {
					isDefault: false
				});
			}

			const request = {
				...input,
				upworkOrganizationId: input.upworkOrganizationId || null,
				upworkOrganizationName: input.upworkOrganizationName || null,
				show_profits: input.show_profits === true ? true : false,
				show_bonuses_paid: input.show_bonuses_paid === true ? true : false,
				show_income: input.show_income === true ? true : false,
				show_total_hours: input.show_total_hours === true ? true : false,
				show_projects_count: input.show_projects_count === false ? false : true,
				show_minimum_project_size: input.show_minimum_project_size === false ? false : true,
				show_clients_count: input.show_clients_count === false ? false : true,
				show_clients: input.show_clients === false ? false : true,
				show_employees_count: input.show_employees_count === false ? false : true
			};

			await this.organizationService.create({
				...request,
				id
			});
		}

		return await this.organizationService.findOneByIdString(id);
	}
}
