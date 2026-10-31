import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, mergeMap } from 'rxjs';
import { mentionsAssignedComments } from './assigned-comments';
import { CommentService } from './comment.service';

/**
 * Leaves the comments the caller may not read out of any route's answer that loads the comments an employee or a team
 * is assigned (`assignedComments`, which `Comment.members` and `Comment.teams` fill), whatever record it reaches them
 * through: an employee, a team, a project's members' employees. A comment of a record whose comments a policy governs
 * (a contact's notes) is kept only for a caller that policy lets read them, as the comment API's own reads keep it;
 * every other comment is answered as before. See {@link CommentService.withReadableLoadedComments}.
 *
 * Registered once, for the whole application (`APP_INTERCEPTOR` in `AppModule`). No record loads those comments unless
 * a request names them, so a request whose query and body do not name `assignedComments` is answered untouched, and
 * nothing is walked. GraphQL answers no `assignedComments` (neither the employee nor the team type declares them), so
 * only HTTP requests are looked at.
 *
 * `CommentService` is read from the application rather than injected, as `FormerEmployeesInterceptor` reads
 * `EmployeeService`. Without one the request fails rather than answer comments unchecked.
 */
@Injectable()
export class ReadableCommentsInterceptor implements NestInterceptor {
	private comments: CommentService | undefined;

	constructor(private readonly moduleRef: ModuleRef) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		if (!namesAssignedComments(context)) {
			return next.handle();
		}
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

/** Whether the request is an HTTP request whose query or body names `assignedComments`. */
function namesAssignedComments(context: ExecutionContext): boolean {
	if (context.getType() !== 'http') {
		return false;
	}
	const request = context.switchToHttp().getRequest<{ query?: unknown; body?: unknown }>();
	return mentionsAssignedComments(request?.query) || mentionsAssignedComments(request?.body);
}
