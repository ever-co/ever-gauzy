import { ICommand } from '@nestjs/cqrs';
import {IFindInputQuery} from '@gauzy/contracts';

export class WorkingEmployeeGetCommand implements ICommand {
	static readonly type = '[Working Employee] Get';

	constructor(
        public readonly input: IFindInputQuery
    ) {}
}