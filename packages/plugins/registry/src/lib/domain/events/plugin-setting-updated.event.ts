import { IEvent } from '@nestjs/cqrs';

export class PluginSettingUpdatedEvent implements IEvent {
	constructor(
		public readonly settingId: string,
		public readonly pluginId: string,
		public readonly key: string,
		public readonly newValue: any,
		public readonly previousValue: any,
		public readonly tenantId: string,
		public readonly organizationId?: string,
		public readonly userId?: string,
		public readonly timestamp = new Date()
	) {}
}
