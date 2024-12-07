import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationProjectSetting } from '@gauzy/contracts';
import { OrganizationProjectService } from '../../organization-project.service';
import { OrganizationProjectSettingUpdateCommand } from '../organization-project-setting.update.command';

@CommandHandler(OrganizationProjectSettingUpdateCommand)
export class OrganizationProjectSettingUpdateHandler
	implements ICommandHandler<OrganizationProjectSettingUpdateCommand>
{
	private readonly logger = new Logger('OrganizationProjectSettingUpdateHandler');

	constructor(private readonly _organizationProjectService: OrganizationProjectService) {}

	/**
	 * Execute an organization project setting update command.
	 *
	 * @param command - An `OrganizationProjectSettingUpdateCommand` object containing the update details.
	 * @returns A promise that resolves to an `IOrganizationProjectSetting` or an `UpdateResult` object representing the result of the update operation.
	 */
	public async execute(command: OrganizationProjectSettingUpdateCommand): Promise<IOrganizationProjectSetting> {
		try {
			// Extract the 'id' and 'input' properties from the command object.
			const { id, input } = command;

			// Update the organization project setting using the provided 'id' and 'input'.
			await this._organizationProjectService.update(id, input);

			// Retrieve and return the updated organization project setting.
			return await this._organizationProjectService.findOneByIdString(id);
		} catch (error) {
			// Handle errors and return an appropriate error response
			this.logger.error('Failed to update project integration settings', error.message);
			throw new HttpException(
				`Failed to update project integration settings: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}
}
