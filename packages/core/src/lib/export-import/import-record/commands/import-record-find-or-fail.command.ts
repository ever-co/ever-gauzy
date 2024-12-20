import { ICommand } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { IImportRecordFind } from '@gauzy/contracts';

export class ImportRecordFindOrFailCommand implements ICommand {
	static readonly type = '[Find Or Fail] Import Record';

	constructor(
		public readonly input: FindOptionsWhere<IImportRecordFind>
	) {}
}