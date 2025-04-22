import { IQuery } from '@nestjs/cqrs';
import { ITimerStatusInput } from '@gauzy/contracts';

export class GetTimerStatusQuery implements IQuery {
	constructor(public readonly input: ITimerStatusInput) {}
}
