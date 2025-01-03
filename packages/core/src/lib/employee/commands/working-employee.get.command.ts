import { ICommand } from '@nestjs/cqrs';

export class WorkingEmployeeGetCommand implements ICommand {
	static readonly type = '[Working Employee] Get';

	constructor(
        public readonly input: any
    ) {}
}