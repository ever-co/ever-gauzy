import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

/**
 * Command to automatically create tags for a plugin based on its properties
 */
export class AutoTagPluginCommand implements ICommand {
	static readonly type = '[PluginTag] Auto Tag Plugin';

	constructor(
		public readonly pluginId: ID,
		public readonly pluginData: {
			name?: string;
			description?: string;
			type?: string;
			category?: string;
			keywords?: string[];
			technologies?: string[];
		},
		public readonly options?: {
			createMissingTags?: boolean;
			overwriteExisting?: boolean;
			tenantId?: ID;
			organizationId?: ID;
		}
	) {}
}
