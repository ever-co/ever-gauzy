import { ICommand } from '@nestjs/cqrs';
import { Activity } from '@gauzy/models';

export class ActivityCreateCommand implements ICommand {
	static readonly type = '[Activity] Create Activity';

	constructor(public readonly input: Activity) {}
}
