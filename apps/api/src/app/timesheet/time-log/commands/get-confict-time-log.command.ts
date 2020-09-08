import { ICommand } from '@nestjs/cqrs';
import { IGetTimeLogConflictInput } from '@gauzy/models';

export class GetConfictTimeLogCommand implements ICommand {
	static readonly type = '[TimeLog] get confict';

	constructor(public readonly input: IGetTimeLogConflictInput) {}
}
