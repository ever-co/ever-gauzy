import { ITimeLog } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class GetTimeLogGroupByProjectCommand implements ICommand {
	static readonly type = '[TimeLog] group by project';

	constructor(public readonly timeLogs: ITimeLog[]) {}
}
