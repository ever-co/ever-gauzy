import { ICommand } from '@nestjs/cqrs';
import { IImportRecord } from '@gauzy/contracts';

export class ImportRecordFirstOrCreateCommand implements ICommand {
	static readonly type = '[Find Or Create] Import Record';

	constructor(
		public readonly input: IImportRecord
	) {}
}