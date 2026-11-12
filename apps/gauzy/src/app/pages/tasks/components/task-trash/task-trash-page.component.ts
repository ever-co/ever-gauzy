import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
	NbButtonModule,
	NbCardModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, startWith } from 'rxjs/operators';
import * as moment from 'moment-timezone';
import { ID, IOrganization, IOrganizationProject } from '@gauzy/contracts';
import { ITrashedTask, Store, TASK_TRASH_PAGE_SIZE, TaskTrashService, ToastrService } from '@gauzy/ui-core/core';

/** Why the page shows no list. */
export type TaskTrashState = 'loading' | 'ready' | 'unavailable' | 'forbidden' | 'error';

/** A trashed task as the page draws it. */
export interface ITrashRow {
	task: ITrashedTask;
	key: string;
	deletedBy: string;
	deletedAt: string;
	project: string;
}

/** The task key the lists show (`API-42`), else `#42`. */
export function taskKeyOf(task: Pick<ITrashedTask, 'taskNumber' | 'prefix' | 'number'>): string {
	if (task.taskNumber) return task.taskNumber;
	if (typeof task.number !== 'number') return '';
	return task.prefix ? `${task.prefix}-${task.number}` : `#${task.number}`;
}

/** The name the trash shows for who deleted a task. */
export function deletedByOf(task: ITrashedTask): string {
	const user = task.deletedByUser;
	const fullName = [user?.firstName, user?.lastName].filter((part) => !!part?.trim()).join(' ').trim();
	return fullName || user?.name?.trim() || '';
}

/** The state a failed read stands for: 404 is a platform without the trash, 403 a reader who may not list it. */
export function trashStateOf(error: unknown): TaskTrashState {
	const status = (error as HttpErrorResponse)?.status;
	if (status === 404) return 'unavailable';
	if (status === 403 || status === 401) return 'forbidden';
	return 'error';
}

/**
 * Whether a Delete forever failed because the task is no longer in the trash: someone restored it, or deleted it, since
 * the list was read. The platform deletes a task only while it is in the trash and answers 404 otherwise.
 */
export function isNoLongerInTrash(error: unknown): boolean {
	return (error as HttpErrorResponse)?.status === 404;
}

/**
 * The organization's deleted tasks (`/pages/tasks/trash`), most recently deleted first, kept to the selected project
 * when one is selected: each can be restored or deleted for good, after an inline confirmation. A search box finds a
 * task by title or number; Load more reads the next page. The page is reached from the tasks page, which offers it
 * only where the platform keeps a trash (`GAUZY_TASK_TRASH_ENABLED`) and to those who may delete tasks.
 */
@Component({
	selector: 'ga-task-trash-page',
	imports: [
		CommonModule,
		ReactiveFormsModule,
		RouterModule,
		NbCardModule,
		NbButtonModule,
		NbFormFieldModule,
		NbIconModule,
		NbInputModule,
		NbListModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe
	],
	templateUrl: './task-trash-page.component.html',
	styleUrls: ['./task-trash-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class TaskTrashPageComponent implements OnInit {
	private readonly _store = inject(Store);
	private readonly _trash = inject(TaskTrashService);
	private readonly _toastr = inject(ToastrService);
	private readonly _translate = inject(TranslateService);
	private readonly _destroyRef = inject(DestroyRef);

	protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
	protected state: TaskTrashState = 'loading';
	protected rows: ITrashRow[] = [];
	protected total = 0;
	protected loadingMore = false;
	/** The task whose row asks "Delete forever?"; one at a time. */
	protected confirmingId: ID | null = null;
	protected busyId: ID | null = null;

	private _organization: IOrganization | null = null;
	private _projectId: ID | null = null;
	/** Numbers each read, so only the latest one is applied. */
	private _sequence = 0;
	/** Whether a read is under way: a restore or delete that ends meanwhile reads the list again (see afterChange). */
	private _reading = false;

	ngOnInit(): void {
		combineLatest([
			this._store.selectedOrganization$.pipe(filter((organization) => !!organization)),
			this._store.selectedProject$.pipe(startWith(null as IOrganizationProject | null)),
			this.searchControl.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged())
		])
			.pipe(takeUntilDestroyed(this._destroyRef))
			.subscribe(([organization, project]) => {
				this._organization = organization;
				// "All projects" is a pseudo-project without an id.
				this._projectId = project?.id || null;
				void this.load(true);
			});
	}

	protected get hasMore(): boolean {
		return this.state === 'ready' && this.rows.length < this.total;
	}

	/** Reads the first page again, or the next page after the rows already shown. */
	protected async load(fromStart = false): Promise<void> {
		const organization = this._organization;
		if (!organization) return;
		const sequence = ++this._sequence;
		this._reading = true;
		if (fromStart) {
			this.state = 'loading';
		} else {
			this.loadingMore = true;
		}
		try {
			const page = await this._trash.list({
				organizationId: organization.id,
				tenantId: organization.tenantId,
				projectId: this._projectId ?? undefined,
				search: this.searchControl.value,
				skip: fromStart ? 0 : this.rows.length,
				take: TASK_TRASH_PAGE_SIZE
			});
			if (sequence !== this._sequence) return;
			const rows = (page?.items ?? []).map((task) => this.toRow(task));
			const seen = new Set((fromStart ? [] : this.rows).map((row) => row.task.id));
			this.rows = fromStart ? rows : [...this.rows, ...rows.filter((row) => !seen.has(row.task.id))];
			this.total = Number(page?.total) || 0;
			this.state = 'ready';
		} catch (error) {
			if (sequence !== this._sequence) return;
			this.state = trashStateOf(error);
		} finally {
			if (sequence === this._sequence) {
				this.loadingMore = false;
				this._reading = false;
			}
		}
	}

	/** Brings a task back; it leaves the list. */
	protected async restore(row: ITrashRow): Promise<void> {
		if (this.busyId) return;
		this.busyId = row.task.id;
		try {
			await this._trash.restore(row.task.id);
			this.afterChange(row);
			this._toastr.success(this._translate.instant('TASKS_PAGE.TRASH.RESTORED', { title: row.task.title }));
		} catch (error) {
			this._toastr.danger(this.messageOf(error), this._translate.instant('TOASTR.TITLE.ERROR'));
		} finally {
			this.busyId = null;
		}
	}

	/**
	 * Deletes a task for good, once its row's confirmation is accepted, and only while it is still in the trash: a task
	 * someone restored or deleted since the list was read is left alone, the reader is told, and the list is read again.
	 */
	protected async deleteForever(row: ITrashRow): Promise<void> {
		const organization = this._organization;
		if (this.busyId || !organization) return;
		this.busyId = row.task.id;
		try {
			await this._trash.deleteForever(row.task.id, organization.id, organization.tenantId);
			this.afterChange(row);
			this._toastr.success(this._translate.instant('TASKS_PAGE.TRASH.DELETED_FOREVER', { title: row.task.title }));
		} catch (error) {
			if (isNoLongerInTrash(error)) {
				this._toastr.warning(
					this._translate.instant('TASKS_PAGE.TRASH.NO_LONGER_IN_TRASH', { title: row.task.title })
				);
				void this.load(true);
			} else {
				this._toastr.danger(this.messageOf(error), this._translate.instant('TOASTR.TITLE.ERROR'));
			}
		} finally {
			this.busyId = null;
			this.confirmingId = null;
		}
	}

	protected trackRow(_index: number, row: ITrashRow): ID {
		return row.task.id;
	}

	/**
	 * After a restore or a delete: the task leaves the list, and a read that started before it ended (a search, Load
	 * more) may still hold the task, so the list is read again from the start instead of applying that read.
	 */
	private afterChange(row: ITrashRow): void {
		this.drop(row);
		if (this._reading) void this.load(true);
	}

	/**
	 * Takes a restored or deleted task off the list. Another list may have been read while the action ran (another
	 * project, another search): its total changes only when it held the task, so its Load more stays right.
	 */
	private drop(row: ITrashRow): void {
		const shown = this.rows.length;
		this.rows = this.rows.filter((candidate) => candidate.task.id !== row.task.id);
		if (this.rows.length < shown) {
			this.total = Math.max(this.total - 1, 0);
		}
	}

	private toRow(task: ITrashedTask): ITrashRow {
		return {
			task,
			key: taskKeyOf(task),
			deletedBy: deletedByOf(task),
			deletedAt: task.deletedAt ? moment(task.deletedAt).format('LLL') : '',
			project: task.project?.name ?? ''
		};
	}

	private messageOf(error: unknown): string {
		const http = error as HttpErrorResponse;
		return http?.error?.message ?? http?.message ?? '';
	}
}
