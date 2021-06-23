import { ICommand } from '@nestjs/cqrs';

export class ImportRecordFindOrFailCommand implements ICommand {
	static readonly type = '[Find Or Fail] Import Record';

	constructor(
		public readonly entityType: string,
		public readonly sourceId: string,
		public readonly tenantId: string
	) {}
}