import { IEvent } from '@nestjs/cqrs';

export class PluginSettingDeletedEvent implements IEvent {
	constructor(
		public readonly settingId: string,
		public readonly pluginId: string,
		public readonly key: string,
		public readonly value: any,
		public readonly tenantId: string,
		public readonly organizationId?: string,
		public readonly userId?: string,
		public readonly timestamp = new Date()
	) {}
}
