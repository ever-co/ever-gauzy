import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Observable, from, map, mergeMap } from 'rxjs';
import { isPassedThrough } from '../core/interceptors/transform.interceptor';
import { HiddenProjectsOptions, withHiddenProjectsWithheld } from './hidden-projects';
import { OrganizationProjectService } from './organization-project.service';

/** The metadata key of {@link HiddenProjectRows}. */
export const HIDDEN_PROJECT_ROWS = 'hidden-project-rows';

/**
 * States how a route's rows name their project beyond the `project` relation any row may carry: the answer is a list
 * of projects (`rootRowsAreProjects`), or a row tells about its project beside it (`withheldWithProject`).
 */
export const HiddenProjectRows = (options: HiddenProjectsOptions) => SetMetadata(HIDDEN_PROJECT_ROWS, options);

/**
 * Answers every project the caller may not see as its id and `projectHidden`, in each answer of the routes it is put
 * on: the time entries, the reports and their charts, the slots, the activities, the statistics, the tasks, the daily
 * plans and the timer status (ever-co/ever-gauzy#12031). The time a hidden project holds stays in every total.
 *
 * The hidden projects are read once per request, before the route runs, by the rule the project routes keep private
 * projects with (see {@link OrganizationProjectService.hiddenProjects}): a read that fails then fails the request
 * before a route that writes (a timer start or stop) has changed anything, so sending it again is safe. Where no
 * organization of the tenant keeps its private projects private, or the caller may see them all, nothing is hidden
 * and the answer goes out as the route gave it, untouched.
 *
 * `OrganizationProjectService` is read from the application rather than injected, as `ReadableCommentsInterceptor`
 * reads `CommentService`, so that every module whose routes use it need not import the project module. Without one
 * the request fails rather than answer a hidden project's name.
 */
@Injectable()
export class HiddenProjectsInterceptor implements NestInterceptor {
	private projects: OrganizationProjectService | undefined;

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly reflector: Reflector
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const options =
			this.reflector.getAllAndOverride<HiddenProjectsOptions>(HIDDEN_PROJECT_ROWS, [
				context.getHandler(),
				context.getClass()
			]) ?? {};
		return from(this.projectService().hiddenProjects()).pipe(
			mergeMap((hidden) =>
				next.handle().pipe(
					map((answer: unknown) => {
						// Nothing to walk: no answer, a number, a file
						if (isPassedThrough(answer)) {
							return answer;
						}
						return withHiddenProjectsWithheld(answer, hidden, options);
					})
				)
			)
		);
	}

	/** The application's `OrganizationProjectService`. */
	private projectService(): OrganizationProjectService {
		this.projects ??= this.moduleRef.get(OrganizationProjectService, { strict: false });
		return this.projects;
	}
}
