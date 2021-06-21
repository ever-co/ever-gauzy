import { ICommand } from '@nestjs/cqrs';
import { IImportRecord } from '@gauzy/contracts';

export class ImportRecordCreateCommand implements ICommand {
	static readonly type = '[Create] Import Record';

	constructor(
		public readonly input: IImportRecord
	) {}
}