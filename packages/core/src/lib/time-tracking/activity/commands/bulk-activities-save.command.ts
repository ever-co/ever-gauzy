import { IBulkActivitiesInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class BulkActivitiesSaveCommand implements ICommand {
	static readonly type = '[Activity] Bulk Create Activities';

	constructor(
		public readonly input: IBulkActivitiesInput
	) { }
}
