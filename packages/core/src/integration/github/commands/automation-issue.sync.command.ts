import { IIntegrationMapSyncEntity, ITaskCreateInput, ITaskUpdateInput } from "@gauzy/contracts";

export class AutomationIssueSyncCommand {

    constructor(
        public readonly input: IIntegrationMapSyncEntity<ITaskCreateInput | ITaskUpdateInput>
    ) { }
}
