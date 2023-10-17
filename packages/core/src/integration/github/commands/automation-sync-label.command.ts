import { IGithubAutomationLabelPayload } from "@gauzy/contracts";

export class AutomationSyncLabelCommand {

    constructor(
        public readonly input: IGithubAutomationLabelPayload
    ) { }
}
