import { IGithubAutomationLabelPayload } from "@gauzy/contracts";

export class AutomationLabelSyncCommand {

    constructor(
        public readonly input: IGithubAutomationLabelPayload
    ) { }
}
