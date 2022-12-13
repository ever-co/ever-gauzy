import { IQuery } from '@nestjs/cqrs';
import { Status } from './../status.entity';
import { PaginationParams } from '../../core/crud/pagination-params';

export class FindAllStatusQuery implements IQuery {
	static readonly type = '[Statuses] Query All';

	constructor(
		public readonly options: PaginationParams<Status>
	) {}
}