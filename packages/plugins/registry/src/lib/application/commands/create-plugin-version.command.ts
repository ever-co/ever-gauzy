import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { PluginVersionDTO } from '../../shared/dto/plugin-version.dto';

/**
 * Command to create a new plugin version.
 */
export class CreatePluginVersionCommand implements ICommand {
	/** Command type identifier */
	public static readonly type = '[Plugin Version] Create';

	/**
	 * Creates an instance of CreatePluginVersionCommand.
	 *
	 * @param {ID} pluginId - The unique identifier of the plugin.
	 * @param {PluginVersionDTO} dto - The data transfer object containing the plugin version details.
	 */
	constructor(public readonly pluginId: ID, public readonly dto: PluginVersionDTO) {}
}
