import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, fromEvent, NEVER } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ID } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { TASK_PAGE_LINK } from '../task-views-ui.constants';
import { outcomeOfResolution, parseGoToInput, ReferenceOutcome } from '../models/task-reference';
import { TaskViewsApiService, TaskViewsScope } from './task-views-api.service';

/** What the go-to box shows after a lookup: the task opened, or why not (an i18n key and its parameters). */
export type GoToResult =
	| { opened: true; outcome?: ReferenceOutcome }
	| { opened: false; messageKey: string; params?: Record<string, unknown> };

const CANCELLED: GoToResult = { opened: false, messageKey: 'TASK_VIEWS.GOTO.CANCELLED' };
const FAILED: GoToResult = { opened: false, messageKey: 'TASK_VIEWS.GOTO.FAILED' };

/**
 * Resolves what was typed into a go-to box (`API-42`, `#api-42`, a task id or link) and opens the task: through the
 * platform's resolver, which answers only tasks the reader may see, by the project's key, its former keys and the
 * key derived from its name.
 */
@Injectable({ providedIn: 'root' })
export class TaskReferenceNavigatorService {
	private readonly api = inject(TaskViewsApiService);
	private readonly router = inject(Router);
	private readonly toastr = inject(ToastrService);

	/**
	 * Looks the text up and opens the task. `signal` is the box's: once it aborts (the box went away, its dialog
	 * closed) the lookup stops, and a navigation still loading the task's page is stopped too, so the task never opens
	 * after the person turned away from it.
	 */
	async goTo(text: string, scope: TaskViewsScope | null, signal?: AbortSignal): Promise<GoToResult> {
		const input = parseGoToInput(text);
		if (input.kind === 'invalid') return { opened: false, messageKey: 'TASK_VIEWS.GOTO.INVALID' };
		if (input.kind === 'id') {
			return this.open(input.id, undefined, signal);
		}
		if (!scope) return FAILED;
		if (signal?.aborted) return CANCELLED;
		let outcome: ReferenceOutcome;
		try {
			const [resolution] = await firstValueFrom(
				this.api
					.resolveReferences([input.reference], scope)
					.pipe(takeUntil(signal ? fromEvent(signal, 'abort') : NEVER))
			);
			outcome = outcomeOfResolution(resolution, input.reference);
		} catch {
			return signal?.aborted ? CANCELLED : FAILED;
		}
		switch (outcome.kind) {
			case 'open':
			case 'moved':
				return this.open(outcome.taskId, outcome, signal);
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

	/**
	 * Opens the task's page; a navigation the router refused or that failed is said as such. A task found by a former
	 * reference is said here, by a service the navigation leaves in place (the box that asked may be gone with the
	 * page it was on).
	 */
	private async open(
		taskId: ID,
		outcome: ReferenceOutcome | undefined,
		signal: AbortSignal | undefined
	): Promise<GoToResult> {
		if (signal?.aborted) return CANCELLED;
		let stop: (() => void) | null = null;
		try {
			const navigating = this.router.navigate([TASK_PAGE_LINK, taskId]);
			// The task's page loads on first use: an abort while it loads stops this navigation (not a later one).
			const navigation = this.router.currentNavigation();
			if (signal && navigation) {
				stop = () => {
					if (this.router.currentNavigation() === navigation) navigation.abort();
				};
				signal.addEventListener('abort', stop, { once: true });
			}
			// `null` is a navigation to the page already open: the task is open.
			const navigated = await navigating;
			if (navigated === false) return signal?.aborted ? CANCELLED : FAILED;
		} catch {
			return FAILED;
		} finally {
			if (stop) signal?.removeEventListener('abort', stop);
		}
		if (outcome?.kind === 'moved') {
			this.toastr.info('TASK_VIEWS.GOTO.MOVED', 'TASK_VIEWS.GOTO.TITLE', {
				translationParams: { reference: outcome.reference, current: outcome.current }
			});
		}
		return { opened: true, ...(outcome ? { outcome } : {}) };
	}
}
