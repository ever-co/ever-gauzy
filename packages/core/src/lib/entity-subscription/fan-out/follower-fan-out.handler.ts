import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CommentEvent } from '../../comment/events';
import { FollowerFanOutService } from './follower-fan-out.service';

/** A comment was created: the followers of its record are told (when fan-out is on). */
@EventsHandler(CommentEvent)
export class FollowerCommentFanOutHandler implements IEventHandler<CommentEvent> {
	constructor(private readonly fanOut: FollowerFanOutService) {}

	async handle(event: CommentEvent): Promise<void> {
		await this.fanOut.onCommentCreated(event);
	}
}
