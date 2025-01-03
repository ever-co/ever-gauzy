import { IEvent } from '@nestjs/cqrs';
import { IMentionCreateInput } from '@gauzy/contracts';

export class CreateMentionEvent implements IEvent {
	constructor(public readonly input: IMentionCreateInput) {}
}
