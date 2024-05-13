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
	ITaskPriority,
	ITaskPriorityFindInput,
	TaskPriorityEnum
} from '@gauzy/contracts';
import { distinctUntilChange, sluggable } from '@gauzy/common-angular';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, TaskPrioritiesService, ToastrService } from '../../../@core/services';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-task-priority-select',
	templateUrl: './task-priority-select.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TaskPrioritySelectComponent),
			multi: true
		}
	]
})
export class TaskPrioritySelectComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	private subject$: Subject<boolean> = new Subject();
	/**
	 * Default global task priorities
	 */
	private _priorities: Array<{
		name: string;
		value: TaskPriorityEnum & any;
	}> = [
		{
			name: TaskPriorityEnum.URGENT,
			value: sluggable(TaskPriorityEnum.URGENT)
		},
		{
			name: TaskPriorityEnum.HIGH,
			value: sluggable(TaskPriorityEnum.HIGH)
		},
		{
			name: TaskPriorityEnum.MEDIUM,
			value: sluggable(TaskPriorityEnum.MEDIUM)
		},
		{
			name: TaskPriorityEnum.LOW,
			value: sluggable(TaskPriorityEnum.LOW)
		}
	];
	public organization: IOrganization;
	public priorities$: BehaviorSubject<ITaskPriority[]> = new BehaviorSubject([]);
	@Output() onChanged = new EventEmitter<ITaskPriority>();

	constructor(
		public readonly translateService: TranslateService,
		public readonly store: Store,
		public readonly taskPrioritiesService: TaskPrioritiesService,
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
	 * Getter & Setter for priority
	 */
	private _priority: ITaskPriority;

	get priority(): ITaskPriority {
		return this._priority;
	}

	set priority(val: ITaskPriority) {
		this._priority = val;
		this.onChange(val);
		this.onTouched(val);
	}

	onChange: any = () => {};

	onTouched: any = () => {};

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getTaskPriorities()),
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

	writeValue(value: ITaskPriority) {
		this.priority = value;
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	selectPriority(priority: ITaskPriority) {
		this.onChanged.emit(priority);
	}

	/**
	 * Get task priorities based organization & project
	 */
	getTaskPriorities() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.taskPrioritiesService
			.get<ITaskPriorityFindInput>({
				tenantId,
				organizationId,
				...(this.projectId
					? {
							projectId: this.projectId
					  }
					: {})
			})
			.pipe(
				map(({ items, total }: IPagination<ITaskPriority>) => (total > 0 ? items : this._priorities)),
				tap((priorities: ITaskPriority[]) => this.priorities$.next(priorities)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create new priority from ng-select tag
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

			const source = this.taskPrioritiesService.create({
				tenantId,
				organizationId,
				name,
				...(this.projectId
					? {
							projectId: this.projectId
					  }
					: {})
			});
			const priority: ITaskPriority = await firstValueFrom(source);
			if (priority) {
				this.priority = priority;
			}
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.subject$.next(true);
		}
	};

	ngOnDestroy(): void {}
}
