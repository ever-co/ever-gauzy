import { ITimeLog } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class GetTimeLogGroupByDateCommand implements ICommand {
	static readonly type = '[TimeLog] group by date';

	constructor(public readonly timeLogs: ITimeLog[]) {}
}
