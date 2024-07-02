import { IGetTaskOptions, ITask } from '@gauzy/contracts';

export class GithubTaskUpdateOrCreateCommand {
	constructor(public readonly task: ITask, public readonly options: IGetTaskOptions) {}
}
