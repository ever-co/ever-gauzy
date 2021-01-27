import { IBulkActivitiesInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class BulkActivitiesSaveCommand implements ICommand {
	static readonly type = '[Screenshot] Create Screenshot';

	constructor(public readonly input: IBulkActivitiesInput) {}
}
