import { ICommand } from '@nestjs/cqrs';
import { ICreateActivityInput } from '@gauzy/models';

export class ActivityCreateCommand implements ICommand {
	static readonly type = '[Activity] Create Activity';

	constructor(public readonly input: ICreateActivityInput) {}
}
