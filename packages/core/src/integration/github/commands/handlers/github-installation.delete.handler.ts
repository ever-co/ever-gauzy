import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OctokitService } from '@gauzy/plugin-integration-github';
import { arrayToObject } from '../../../../core/utils';
import { GithubInstallationDeleteCommand } from '../github-installation.delete.command';

@CommandHandler(GithubInstallationDeleteCommand)
export class GithubInstallationDeleteCommandHandler implements ICommandHandler<GithubInstallationDeleteCommand> {
	constructor(private readonly _octokitService: OctokitService) {}

	/**
	 * Execute the GitHub installation deletion command.
	 * @param command - The GithubInstallationDeleteCommand instance.
	 */
	async execute(command: GithubInstallationDeleteCommand) {
		const { integration } = command;

		// Convert array of settings to an object using 'arrayToObject' utility function
		const settings = arrayToObject(integration.settings, 'settingsName', 'settingsValue');

		// Check if the required installation_id is present in settings
		if (!settings || !settings.installation_id) {
			throw new HttpException(
				'Invalid request parameter: Missing or unauthorized integration',
				HttpStatus.UNAUTHORIZED
			);
		}

		// Retrieve installation_id from settings
		const installation_id = settings['installation_id'];

		// Call the OctokitService to delete the GitHub installation
		return await this._octokitService.deleteInstallation(installation_id);
	}
}
