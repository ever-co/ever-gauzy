import { IMatchingCriterions } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class SavePresetCriterionCommand implements ICommand {
	static readonly type = '[JobPresetCriterion] Create';

	constructor(public readonly input?: IMatchingCriterions) {}
}
