import { IIntegrationMapSyncEntity, ITagCreateInput, ITagUpdateInput, IntegrationEntity } from '@gauzy/contracts';

export class AutomationLabelSyncCommand {
	constructor(
		public readonly input: IIntegrationMapSyncEntity<ITagCreateInput | ITagUpdateInput>,
		public readonly entity: IntegrationEntity
	) {}
}
