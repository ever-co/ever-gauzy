import { IQuery } from '@nestjs/cqrs';
import { IStatusFindInput } from '@gauzy/contracts';

export class FindStatusesQuery implements IQuery {
	static readonly type = '[Statuses] Query All';

	constructor(public readonly options: IStatusFindInput) {}
}
