import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, Observable, of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { ID, IOrganizationProject, IPagination, ITask } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { ChatTaskSummary, taskSummaryOf } from '../chat-tasks';
import { ChatAvailabilityService } from './chat-availability.service';

/** How many task cards are read at once. */
const TASK_READS_AT_ONCE = 4;

/** A project a task can be created in. */
export interface ChatProjectChoice {
	id: string;
	name: string;
}

/**
 * The platform's task routes chat uses: a task's summary for its card (`GET /api/tasks/:id`, the task permissions
 * apply), and the projects of the organization a task can be created in (`GET /api/organization-projects`).
 *
 * Summaries are kept by task id for the page's life (dropped when the user or the organization changes); a task the
 * reader may not see is kept as `null`, and its card shows the task's id only, as before.
 */
@Injectable({ providedIn: 'root' })
export class ChatTasksService {
	private readonly http = inject(HttpClient);
	private readonly destroyRef = inject(DestroyRef);

	private readonly known = signal<ReadonlyMap<string, ChatTaskSummary | null>>(new Map());
	/** The summaries read so far; `null` for a task the reader may not see. */
	readonly summaries = this.known.asReadonly();
	private readonly asked = new Set<string>();
	private scope = 0;
	private organizationId: string | null = null;

	constructor() {
		inject(ChatAvailabilityService)
			.scope$.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((scope) => {
				this.scope += 1;
				this.organizationId = scope?.organizationId ?? null;
				this.asked.clear();
				this.known.set(new Map());
			});
	}

	/** Reads the summaries of these tasks that were not asked for yet. */
	ensure(taskIds: readonly string[]): void {
		const wanted = [...new Set(taskIds.map(String))].filter((id) => !this.asked.has(id));
		if (!wanted.length) return;
		for (const id of wanted) this.asked.add(id);
		const scope = this.scope;
		from(wanted)
			.pipe(
				mergeMap((id) => this.summary(id).pipe(map((summary) => [id, summary] as const)), TASK_READS_AT_ONCE),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(([id, summary]) => {
				if (scope !== this.scope) return;
				const next = new Map(this.known());
				next.set(id, summary);
				this.known.set(next);
			});
	}

	/** Puts a task the page already holds (one just created) among the summaries. */
	remember(task: ITask): void {
		const summary = taskSummaryOf(task);
		this.asked.add(summary.id);
		const next = new Map(this.known());
		next.set(summary.id, summary);
		this.known.set(next);
	}

	/**
	 * One task's summary, or null when the reader may not see it (or it is gone). Read through the task list
	 * (`GET /api/tasks?where[id]=…`), not `GET /api/tasks/:id`: that read counts as a visit and would put every task a
	 * conversation shows into the reader's recent items.
	 */
	summary(id: ID): Observable<ChatTaskSummary | null> {
		const where = { id: String(id), ...(this.organizationId ? { organizationId: this.organizationId } : {}) };
		return this.http
			.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, { params: toParams({ where, relations: ['taskStatus'], take: 1 }) })
			.pipe(
				map((page) => {
					const task = (page?.items ?? []).find((item) => String(item?.id) === String(id));
					return task ? taskSummaryOf(task) : null;
				}),
				catchError(() => of(null))
			);
	}

	/** The projects of the organization, by name. */
	projects(organizationId: ID, tenantId: ID | null): Observable<ChatProjectChoice[]> {
		return this.http
			.get<IPagination<IOrganizationProject>>(`${API_PREFIX}/organization-projects`, {
				params: toParams({ where: { organizationId, ...(tenantId ? { tenantId } : {}) } })
			})
			.pipe(
				map((page) =>
					(page?.items ?? [])
						.filter((project) => !!project?.id)
						.map((project) => ({ id: String(project.id), name: (project.name ?? '').trim() || String(project.id) }))
						.sort((a, b) => a.name.localeCompare(b.name))
				)
			);
	}
}
