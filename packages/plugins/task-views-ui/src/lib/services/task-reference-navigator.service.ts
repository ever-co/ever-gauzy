import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TASK_PAGE_LINK } from '../task-views-ui.constants';
import { outcomeOfResolution, parseGoToInput, ReferenceOutcome } from '../models/task-reference';
import { TaskViewsApiService, TaskViewsScope } from './task-views-api.service';

/** What the go-to box shows after a lookup: the task opened, or why not (an i18n key and its parameters). */
export type GoToResult =
	| { opened: true; outcome?: ReferenceOutcome }
	| { opened: false; messageKey: string; params?: Record<string, unknown> };

/**
 * Resolves what was typed into a go-to box (`API-42`, `#api-42`, a task id or link) and opens the task: through the
 * platform's resolver, which answers only tasks the reader may see, by the project's key, its former keys and the
 * key derived from its name.
 */
@Injectable({ providedIn: 'root' })
export class TaskReferenceNavigatorService {
	private readonly api = inject(TaskViewsApiService);
	private readonly router = inject(Router);

	async goTo(text: string, scope: TaskViewsScope | null): Promise<GoToResult> {
		const input = parseGoToInput(text);
		if (input.kind === 'invalid') return { opened: false, messageKey: 'TASK_VIEWS.GOTO.INVALID' };
		if (input.kind === 'id') {
			await this.router.navigate([TASK_PAGE_LINK, input.id]);
			return { opened: true };
		}
		if (!scope) return { opened: false, messageKey: 'TASK_VIEWS.GOTO.FAILED' };
		let outcome: ReferenceOutcome;
		try {
			const [resolution] = await firstValueFrom(this.api.resolveReferences([input.reference], scope));
			outcome = outcomeOfResolution(resolution, input.reference);
		} catch {
			return { opened: false, messageKey: 'TASK_VIEWS.GOTO.FAILED' };
		}
		switch (outcome.kind) {
			case 'open':
			case 'moved':
				await this.router.navigate([TASK_PAGE_LINK, outcome.taskId]);
				return { opened: true, outcome };
			case 'ambiguous':
				return {
					opened: false,
					messageKey: 'TASK_VIEWS.GOTO.AMBIGUOUS',
					params: { reference: outcome.reference }
				};
			default:
				return {
					opened: false,
					messageKey: 'TASK_VIEWS.GOTO.NOT_FOUND',
					params: { reference: outcome.reference }
				};
		}
	}
}
