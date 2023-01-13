import { Component, OnInit, OnDestroy, Input, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { IOrganization, ITask, PermissionsEnum, TaskStatusEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subject, firstValueFrom, Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { AuthService, Store, TasksService, ToastrService } from './../../../../@core/services';

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
export class TaskSelectorComponent implements
	OnInit, OnDestroy, ControlValueAccessor {

	/*
	* Getter & Setter for dynamic enabled/disabled element
	*/
	_disabled: boolean = false;
	public get disabled(): boolean {
		return this._disabled;
	}
	@Input() public set disabled(value: boolean) {
		this._disabled = value;
	}

	/*
	* Getter & Setter for dynamic add task option
	*/
	_addTag: boolean = true;
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
		this.onTouched(value);
	}

	public organization: IOrganization;
	public hasPermissionAddTask$: Observable<boolean>;
	tasks: ITask[] = [];
	subject$: Subject<any> = new Subject();

	constructor(
		private readonly tasksService: TasksService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly authService: AuthService,
	) { }

	onChange: any = () => { };
	onTouched: any = () => { };

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
				tap((organization: IOrganization) => this.organization = organization),
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

	createNew = async (title: ITask['title']) => {
		if (!this.organization || !title) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId} = this.organization;

		try {
			const member: any = {
				id: this.employeeId || this.store.user.employeeId
			};
			const task = await firstValueFrom(this.tasksService
				.createTask({
					title,
					organizationId,
					tenantId,
					status: TaskStatusEnum.IN_PROGRESS,
					...(member.id && { members: [member] }),
					...(this.projectId && { projectId: this.projectId }),
				}));
			this.tasks = this.tasks.concat(task);
			this.taskId = task.id;
		} catch (error) {
			this.toastrService.error(error);
		}
	};

	async getTasks() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId} = this.organization;

		if (this.employeeId) {
			this.tasks = await this.tasksService.getAllTasksByEmployee(
				this.employeeId,
				{
					where: {
						...(this.projectId
							? {
								projectId: this.projectId
							  }
							: {}),
						organizationId,
						tenantId
					}
				}
			);
		} else {
			const { items = [] } = await firstValueFrom(this.tasksService
				.getAllTasks({
					...(this.projectId
						? {
							projectId: this.projectId
						  }
						: {}),
					organizationId,
					tenantId
				}));
			this.tasks = items;
		}
	}

	ngOnDestroy(): void { }
}
