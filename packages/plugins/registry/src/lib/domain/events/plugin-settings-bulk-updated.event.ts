import { IEvent } from '@nestjs/cqrs';

export class PluginSettingsBulkUpdatedEvent implements IEvent {
	constructor(
		public readonly pluginId: string,
		public readonly changedSettings: Array<{
			key: string;
			newValue: any;
			oldValue: any;
		}>,
		public readonly pluginTenantId?: string,
		public readonly tenantId?: string,
		public readonly organizationId?: string,
		public readonly userId?: string,
		public readonly timestamp = new Date()
	) {}
}
