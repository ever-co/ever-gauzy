import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSecurityService } from '../../../domain/services/plugin-security.service';
import { PluginService } from '../../../domain/services/plugin.service';
import { VerifyPluginCommand } from '../../commands/verify-plugin.command';

/**
 * Command handler responsible for verifying plugin signatures.
 *
 * This handler processes VerifyPluginCommand requests and delegates to the
 * PluginSecurityService to authenticate plugin signatures against their version IDs.
 *
 * @implements {ICommandHandler<VerifyPluginCommand>}
 */
@CommandHandler(VerifyPluginCommand)
export class VerifyPluginCommandHandler implements ICommandHandler<VerifyPluginCommand> {
	/**
	 * Creates an instance of VerifyPluginCommandHandler.
	 *
	 * @param {PluginSecurityService} securityService - Service responsible for plugin security operations
	 * @param {PluginService} pluginService - Service responsible for plugin operations
	 */
	constructor(
		private readonly securityService: PluginSecurityService,
		private readonly pluginService: PluginService
	) {}

	/**
	 * Executes the verify plugin command.
	 *
	 * Extracts the version ID and signature from the command input and
	 * forwards them to the security service for verification.
	 *
	 * @param {VerifyPluginCommand} command - The command containing plugin verification data
	 * @returns {Promise<boolean>} True if the signature is valid, false otherwise
	 * @throws {NotFoundException} When the plugin with the specified ID is not found
	 */
	public async execute(command: VerifyPluginCommand): Promise<boolean> {
		const { input, pluginId } = command;

		// Verify plugin ID
		const plugin = await this.pluginService.findOneOrFailByIdString(pluginId);
		if (!plugin.success) {
			throw new NotFoundException(`Plugin with ID ${pluginId} not found`);
		}

		// Verify the plugin version ID and signature
		return this.securityService.verifySignature(input.versionId, input.signature);
	}
}
