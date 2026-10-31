import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, mergeMap } from 'rxjs';
import { CommentService } from './comment.service';

/**
 * Leaves the comments the caller may not read out of what a route answers through another record: the comments an
 * employee or a team is assigned (`assignedComments`, which `Comment.members` and `Comment.teams` fill), and any
 * comment loaded beside them. A comment of a record whose comments a policy governs (a contact's notes) is kept only
 * for a caller that policy lets read them, as the comment API's own reads keep it; every other comment is answered as
 * before. See {@link CommentService.withReadableLoadedComments}.
 *
 * Usage: `@UseInterceptors(ReadableCommentsInterceptor)` on the controller. `CommentService` is read from the
 * application rather than injected, as `FormerEmployeesInterceptor` reads `EmployeeService`: the comment module imports
 * the employee module, which therefore cannot import it back. Without a `CommentService` the route fails rather than
 * answer comments unchecked.
 */
@Injectable()
export class ReadableCommentsInterceptor implements NestInterceptor {
	private comments: CommentService | undefined;

	constructor(private readonly moduleRef: ModuleRef) {}

	intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next
			.handle()
			.pipe(mergeMap((response: unknown) => this.commentService().withReadableLoadedComments(response)));
	}

	/** The application's `CommentService`. */
	private commentService(): CommentService {
		this.comments ??= this.moduleRef.get(CommentService, { strict: false });
		return this.comments;
	}
}
