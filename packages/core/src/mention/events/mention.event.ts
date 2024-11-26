import { IEvent } from '@nestjs/cqrs';
import { IMentionCreateInput } from '@gauzy/contracts';

export class MentionEvent implements IEvent {
	constructor(public readonly input: IMentionCreateInput) {}
}
