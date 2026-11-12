import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, Observable, of } from 'rxjs';
import { catchError, map, mergeMap, shareReplay, tap } from 'rxjs/operators';
import { ID, IChatMessageWithRelations, IOrganizationProject, IPagination, ITask, ITaskStatus } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { ChatTaskStatusChoice, ChatTaskSummary, statusChoicesOf, taskSummaryOf } from '../chat-tasks';
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
	/**
	 * The latest read of each task (a number given to every read, and to every summary put in place): only the answer of
	 * the latest read is kept, so an older read that answers last never overwrites a newer summary.
	 */
	private readonly latestRead = new Map<string, number>();
	private reads = 0;
	private scope = 0;
	private organizationId: string | null = null;
	/** The status records read for a project (by organization and project), shared by its cards. */
	private readonly statusReads = new Map<string, Observable<Array<{ id: string | null; name?: string; value?: string; order?: number }>>>();

	constructor() {
		inject(ChatAvailabilityService)
			.scope$.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((scope) => {
				this.scope += 1;
				this.organizationId = scope?.organizationId ?? null;
				this.asked.clear();
				this.latestRead.clear();
				this.statusReads.clear();
				this.known.set(new Map());
			});
	}

	/** Reads the summaries of these tasks that were not asked for yet. */
	ensure(taskIds: readonly string[]): void {
		const wanted = [...new Set(taskIds.map(String))].filter((id) => !this.asked.has(id));
		if (!wanted.length) return;
		for (const id of wanted) this.asked.add(id);
		const scope = this.scope;
		from(wanted.map((id) => [id, this.nextRead(id)] as const))
			.pipe(
				mergeMap(([id, read]) => this.summary(id).pipe(map((summary) => [id, read, summary] as const)), TASK_READS_AT_ONCE),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(([id, read, summary]) => {
				if (scope !== this.scope || this.latestRead.get(id) !== read) return;
				// A passing failure is asked again by the next message that shows the task.
				if (summary === undefined) {
					this.asked.delete(id);
					return;
				}
				const next = new Map(this.known());
				next.set(id, summary);
				this.known.set(next);
			});
	}

	/**
	 * Reads these tasks' summaries again (a card changed one, or a message that shows them changed): the cards keep
	 * what they show until the new summary arrives.
	 */
	refresh(taskIds: readonly string[]): void {
		const ids = [...new Set(taskIds.map(String))].filter((id) => this.asked.has(id));
		for (const id of ids) this.asked.delete(id);
		if (ids.length) this.ensure(ids);
	}

	/**
	 * Reads one task's summary again now and puts it among the summaries (a card that just changed the task waits for
	 * it). A failed read leaves the summary shown as it was.
	 */
	reload(taskId: string): Observable<ChatTaskSummary | null | undefined> {
		const id = String(taskId);
		const scope = this.scope;
		this.asked.add(id);
		const read = this.nextRead(id);
		return this.summary(id).pipe(
			tap((summary) => {
				if (scope !== this.scope || this.latestRead.get(id) !== read) return;
				// A passing failure: the next message that shows the task asks again.
				if (summary === undefined) {
					this.asked.delete(id);
					return;
				}
				const next = new Map(this.known());
				next.set(id, summary);
				this.known.set(next);
			})
		);
	}

	/** Reads again every task the messages show (after a catch-up: changes made meanwhile sent no hint here). */
	refreshAll(messages: ReadonlyArray<Pick<IChatMessageWithRelations, 'taskReferences'> | null | undefined>): void {
		this.refresh(messages.flatMap((message) => (message?.taskReferences ?? []).map((reference) => String(reference.taskId))));
	}

	/** A new read of a task: the one whose answer is kept. */
	private nextRead(id: string): number {
		const read = ++this.reads;
		this.latestRead.set(id, read);
		return read;
	}

	/**
	 * Reads again the tasks a message shows (one of the messages given), when that message was told it changed: a card
	 * changed elsewhere tells every message that shows its task.
	 */
	refreshShownBy(messages: ReadonlyArray<Pick<IChatMessageWithRelations, 'id' | 'taskReferences'> | null | undefined>, messageId: string): void {
		const message = messages.find((item) => !!item && String(item.id) === String(messageId));
		const taskIds = (message?.taskReferences ?? []).map((reference) => String(reference.taskId));
		if (taskIds.length) this.refresh(taskIds);
	}

	/**
	 * The statuses a card offers for a task: the status records of its project (the organization's when it has none),
	 * read once per project for the page's life; the task's own status when they cannot be read.
	 */
	statusChoices(task: ChatTaskSummary): Observable<ChatTaskStatusChoice[]> {
		const organizationId = task.organizationId ?? this.organizationId;
		const key = `${organizationId ?? ''}:${task.projectId ?? ''}`;
		let read = this.statusReads.get(key);
		if (!read) {
			const params = toParams({ ...(organizationId ? { organizationId } : {}), ...(task.projectId ? { projectId: task.projectId } : {}) });
			read = this.http.get<IPagination<ITaskStatus>>(`${API_PREFIX}/task-statuses`, { params }).pipe(
				map((page) => (page?.items ?? []).map((status) => ({ id: status.id ? String(status.id) : null, name: status.name, value: status.value, order: status.order }))),
				catchError(() => {
					// Not kept for the next cards: a passing failure is asked again by the next card that opens.
					this.statusReads.delete(key);
					return of([] as Array<{ id: string | null; name?: string; value?: string; order?: number }>);
				}),
				shareReplay(1)
			);
			this.statusReads.set(key, read);
		}
		return read.pipe(map((records) => statusChoicesOf(records, task.status)));
	}

	/** Puts a task the page already holds (one just created) among the summaries. */
	remember(task: ITask): void {
		const summary = taskSummaryOf(task);
		this.asked.add(summary.id);
		// Newer than any read still under way for it: their answers are not kept.
		this.nextRead(summary.id);
		const next = new Map(this.known());
		next.set(summary.id, summary);
		this.known.set(next);
	}

	/**
	 * One task's summary; null when the reader may not see it or it is gone (the list does not hold it, or a 401 /
	 * 403 / 404); undefined after a passing failure (worth asking again). Read through the task list
	 * (`GET /api/tasks?where[id]=…`), not `GET /api/tasks/:id`: that read counts as a visit and would put every task a
	 * conversation shows into the reader's recent items.
	 */
	summary(id: ID): Observable<ChatTaskSummary | null | undefined> {
		const where = { id: String(id), ...(this.organizationId ? { organizationId: this.organizationId } : {}) };
		return this.http
			.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, { params: toParams({ where, relations: ['taskStatus', 'members'], take: 1 }) })
			.pipe(
				map((page) => {
					const task = (page?.items ?? []).find((item) => String(item?.id) === String(id));
					return task ? taskSummaryOf(task) : null;
				}),
				catchError((error: HttpErrorResponse) => of(error?.status === 401 || error?.status === 403 || error?.status === 404 ? null : undefined))
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
