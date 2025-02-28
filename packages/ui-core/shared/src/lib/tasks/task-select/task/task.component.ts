import { Component, OnInit, Input, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { Subject, firstValueFrom, Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization, ITask, PermissionsEnum, TaskStatusEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { AuthService, Store, TasksService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-task-selector',
	templateUrl: './task.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TaskSelectorComponent),
			multi: true
		}
	]
})
export class TaskSelectorComponent implements OnInit, ControlValueAccessor {
	private _multiple = false;
	public get multiple(): boolean {
		return this._multiple;
	}
	@Input() public set multiple(value: boolean) {
		this._multiple = value;
	}

	/*
	 * Getter & Setter for dynamic enabled/disabled element
	 */
	_disabled = false;
	public get disabled(): boolean {
		return this._disabled;
	}
	@Input() public set disabled(value: boolean) {
		this._disabled = value;
	}

	/*
	 * Getter & Setter for dynamic add task option
	 */
	_addTag = true;
	get addTag(): boolean {
		return this._addTag;
	}
	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	/*
	 * Getter & Setter for set projectId
	 */
	private _projectId: string;
	public get projectId(): string {
		return this._projectId;
	}
	@Input() public set projectId(value: string) {
		this._projectId = value;
		this.subject$.next(true);
	}

	/*
	 * Getter & Setter for set employeeId
	 */
	private _employeeId: string;
	public get employeeId(): string {
		return this._employeeId;
	}
	@Input() public set employeeId(value: string) {
		this._employeeId = value;
		this.subject$.next(true);
	}

	/*
	 * Getter & Setter for internal taskId
	 */
	private _taskId: string;
	public get taskId(): string {
		return this._taskId;
	}
	public set taskId(value: string) {
		this._taskId = value;
		this.onChange(value);
	}

	public organization: IOrganization;
	public hasPermissionAddTask$: Observable<boolean>;
	tasks: ITask[] = [];
	subject$: Subject<any> = new Subject();

	constructor(
		private readonly tasksService: TasksService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly authService: AuthService
	) {}

	onChange: any = () => {};
	onTouched: any = () => {};

	ngOnInit() {
		this.hasPermissionAddTask$ = this.authService.hasPermissions(
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_ADD
		);
		this.subject$
			.pipe(
				tap(() => this.getTasks()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	writeValue(value: any) {
		this.taskId = value;
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	/**
	 * Creates a new task with the given title.
	 * @param {string} title - The title of the new task.
	 * @returns {Promise<void>} - A Promise that resolves when the task is created.
	 */
	createNew = async (title: ITask['title']): Promise<void> => {
		try {
			// Check if organization or title is not defined, return if so
			if (!this.organization || !title) {
				return;
			}

			// Extract organization and tenant IDs
			const { id: organizationId, tenantId } = this.organization;

			// Extract employee ID from store user
			const { employee } = this.store.user;
			const employeeId = employee?.id;

			// Prepare member object
			const member: any = {
				id: this.employeeId || employeeId
			};

			// Create the task
			const task = await firstValueFrom(
				this.tasksService.createTask({
					title,
					organizationId,
					tenantId,
					status: TaskStatusEnum.IN_PROGRESS,
					...(member.id && { members: [member] }),
					...(this.projectId && { projectId: this.projectId })
				})
			);

			// Update tasks list and taskId
			this.tasks = [...this.tasks, task];
			this.taskId = task.id;
		} catch (error) {
			// Show error message if task creation fails
			this.toastrService.error(error);
		}
	};

	/**
	 * Retrieves tasks based on organization, employee, and project.
	 * @returns {Promise<void>} - A Promise that resolves when tasks are retrieved.
	 */
	async getTasks(): Promise<void> {
		try {
			// Check if organization is not defined, return if so
			if (!this.organization) {
				return;
			}

			// Extract organization and tenant IDs
			const { id: organizationId, tenantId } = this.organization;

			// Prepare query parameters
			const queryOption: any = {
				...(this.projectId ? { projectId: this.projectId } : {}),
				organizationId,
				tenantId
			};

			// Retrieve tasks based on employee or all tasks
			if (this.employeeId) {
				this.tasks = await this.tasksService.getAllTasksByEmployee(this.employeeId, { where: queryOption });
			} else {
				const { items = [] } = await firstValueFrom(this.tasksService.getAllTasks({ ...queryOption }));
				this.tasks = items;
			}
		} catch (error) {
			// Log error if task retrieval fails
			console.error('Error while retrieving tasks:', error);
		}
	}

	markAsTouchedOnInteraction(): void {
		this.onTouched();
	}
}
