import { ICommand } from '@nestjs/cqrs';
import { ITimeLog } from '@gauzy/contracts';

export class GetTimeLogGroupByDateCommand implements ICommand {
	static readonly type = '[TimeLog] group by date';

	constructor(public readonly timeLogs: ITimeLog[], public readonly logActivity: Record<string, number>, public readonly timeZone: string) {}
}
