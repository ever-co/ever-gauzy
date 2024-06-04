import { AfterViewInit, Component, EventEmitter, forwardRef, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { combineLatest, debounceTime, firstValueFrom, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import {
	IOrganization,
	IOrganizationProject,
	IPagination,
	ITaskStatus,
	ITaskStatusFindInput,
	TaskStatusEnum
} from '@gauzy/contracts';
import { distinctUntilChange, sluggable } from '@gauzy/ui-sdk/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@gauzy/ui-sdk/common';
import { TaskStatusesService } from '@gauzy/ui-sdk/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { ToastrService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-task-status-select',
	templateUrl: './task-status-select.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TaskStatusSelectComponent),
			multi: true
		}
	]
})
export class TaskStatusSelectComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	private subject$: Subject<boolean> = new Subject();
	/**
	 * Default global task statuses
	 */
	private _statuses: Array<{ name: string; value: TaskStatusEnum & any }> = [
		{
			name: TaskStatusEnum.OPEN,
			value: sluggable(TaskStatusEnum.OPEN)
		},
		{
			name: TaskStatusEnum.IN_PROGRESS,
			value: sluggable(TaskStatusEnum.IN_PROGRESS)
		},
		{
			name: TaskStatusEnum.READY_FOR_REVIEW,
			value: sluggable(TaskStatusEnum.READY_FOR_REVIEW)
		},
		{
			name: TaskStatusEnum.IN_REVIEW,
			value: sluggable(TaskStatusEnum.IN_REVIEW)
		},
		{
			name: TaskStatusEnum.BLOCKED,
			value: sluggable(TaskStatusEnum.BLOCKED)
		},
		{
			name: TaskStatusEnum.COMPLETED,
			value: sluggable(TaskStatusEnum.COMPLETED)
		}
	];
	public organization: IOrganization;
	public statuses$: BehaviorSubject<ITaskStatus[]> = new BehaviorSubject([]);
	@Output() onChanged = new EventEmitter<ITaskStatus>();

	constructor(
		public readonly translateService: TranslateService,
		public readonly store: Store,
		public readonly taskStatusesService: TaskStatusesService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	/*
	 * Getter & Setter for selected organization project
	 */
	private _projectId: IOrganizationProject['id'];

	get projectId(): IOrganizationProject['id'] {
		return this._projectId;
	}

	@Input() set projectId(value: IOrganizationProject['id']) {
		this._projectId = value;
		this.subject$.next(true);
	}

	/*
	 * Getter & Setter for dynamic add tag option
	 */
	private _addTag: boolean = true;

	get addTag(): boolean {
		return this._addTag;
	}

	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	private _placeholder: string;

	get placeholder(): string {
		return this._placeholder;
	}

	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for status
	 */
	private _status: ITaskStatus;

	get status(): ITaskStatus {
		return this._status;
	}

	set status(val: ITaskStatus) {
		this._status = val;
		this.onChange(val);
		this.onTouched(val);
	}

	onChange: any = () => {};

	onTouched: any = () => {};

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getStatuses()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeProject$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, project]) => {
					this.organization = organization;
					this.projectId = project ? project.id : null;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	writeValue(value: ITaskStatus) {
		this.status = value;
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	selectStatus(status: ITaskStatus) {
		this.onChanged.emit(status);
	}

	/**
	 * Get task statuses based organization & project
	 */
	getStatuses() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.taskStatusesService
			.get<ITaskStatusFindInput>({
				tenantId,
				organizationId,
				...(this.projectId
					? {
							projectId: this.projectId
					  }
					: {})
			})
			.pipe(
				map(({ items, total }: IPagination<ITaskStatus>) => (total > 0 ? items : this._statuses)),
				tap((statuses: ITaskStatus[]) => this.statuses$.next(statuses)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create new status from ng-select tag
	 *
	 * @param name
	 * @returns
	 */
	createNew = async (name: string) => {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const source = this.taskStatusesService.create({
				tenantId,
				organizationId,
				name,
				...(this.projectId
					? {
							projectId: this.projectId
					  }
					: {})
			});
			await firstValueFrom(source);
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.subject$.next(true);
		}
	};

	ngOnDestroy(): void {}
}
