import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService, PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { UpdatePluginSubscriptionCommand } from '../update-plugin-subscription.command';
import {
	permittedSubscriptionChanges,
	resolveSubscriptionWriteAccess,
	writeSubscriptionChanges
} from './subscription-write-access';

@CommandHandler(UpdatePluginSubscriptionCommand)
export class UpdatePluginSubscriptionCommandHandler implements ICommandHandler<UpdatePluginSubscriptionCommand> {
	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginService: PluginService
	) {}

	/**
	 * Writes the fields of the update the caller may change: the subscriber's tenant its own settings (auto-renew,
	 * metadata), the plugin's publisher the status and the dates. The rest is ignored; see `subscription-write-access.ts`.
	 */
	async execute(command: UpdatePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { id, updateDto, pluginId } = command;

		const access = await resolveSubscriptionWriteAccess(
			this.pluginSubscriptionService,
			this.pluginService,
			id,
			pluginId
		);
		const changes = permittedSubscriptionChanges(updateDto, access);

		return writeSubscriptionChanges(this.pluginSubscriptionService, access, changes);
	}
}
