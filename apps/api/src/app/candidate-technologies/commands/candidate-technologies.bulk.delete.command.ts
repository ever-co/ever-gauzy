import { ICommand } from '@nestjs/cqrs';
import { ICandidateTechnologies } from '@gauzy/models';

export class CandidateTechnologiesBulkDeleteCommand implements ICommand {
	static readonly type = '[CandidateTechnologies] Delete';

	constructor(
		public readonly id: string,
		public readonly technologies?: ICandidateTechnologies[]
	) {}
}
