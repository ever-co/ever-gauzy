import { IGetTaskOptions, ITask } from "@gauzy/contracts";

export class GithubTaskOpenedCommand {

    constructor(
        public readonly task: ITask,
        public readonly options: IGetTaskOptions,
    ) { }
}
