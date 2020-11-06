import { ITimeLog } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class GetTimeLogGroupByClientCommand implements ICommand {
	static readonly type = '[TimeLog] group by client';

	constructor(public readonly timeLogs: ITimeLog[]) {}
}
