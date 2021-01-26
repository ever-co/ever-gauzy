import { ICommand } from '@nestjs/cqrs';
import { ICandidateTechnologies } from '@gauzy/contracts';

export class CandidateTechnologiesBulkUpdateCommand implements ICommand {
	static readonly type = '[CandidateTechnologies] Update';

	constructor(public readonly technologies: ICandidateTechnologies[]) {}
}
