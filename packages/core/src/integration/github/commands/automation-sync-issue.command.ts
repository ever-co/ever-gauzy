import { IIntegrationMapSyncEntity, ITaskCreateInput, ITaskUpdateInput } from "@gauzy/contracts";

export class AutomationSyncIssueCommand {

    constructor(
        public readonly input: IIntegrationMapSyncEntity<ITaskCreateInput | ITaskUpdateInput>
    ) { }
}
