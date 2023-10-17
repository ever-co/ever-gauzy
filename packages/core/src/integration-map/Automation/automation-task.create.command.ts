import { ITaskCreateInput } from "@gauzy/contracts";

export class AutomationIssueCreateCommand {

    constructor(
        public readonly input: ITaskCreateInput
    ) { }
}
