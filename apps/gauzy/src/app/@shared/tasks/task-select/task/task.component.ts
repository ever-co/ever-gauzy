import { Component, OnInit, OnDestroy, Input, forwardRef, AfterViewInit } from '@angular/core';
import { ITask, PermissionsEnum, TaskStatusEnum } from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { TasksService } from '../../../../@core/services/tasks.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';

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
export class TaskSelectorComponent
	implements AfterViewInit, OnInit, OnDestroy, ControlValueAccessor {

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
	_allowAddNew: boolean = true;
	public get allowAddNew(): boolean {
		return this._allowAddNew;
	}
	@Input() public set allowAddNew(value: boolean) {
		this._allowAddNew = value;
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

	public hasPermissionTaskEdit: boolean;
	tasks: ITask[] = [];
	subject$: Subject<any> = new Subject();

	constructor(
		private tasksService: TasksService,
		private toastrService: ToastrService,
		private store: Store
	) { }

	onChange: any = () => { };
	onTouched: any = () => { };

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.hasPermissionTaskEdit = this.store.hasPermission(
					PermissionsEnum.ORG_CANDIDATES_TASK_EDIT
				);
			});
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.getTasks()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.subject$.next(true);
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

	createNew = async (title: string) => {
		const organizationId = this.store.selectedOrganization.id;
		try {
			const member: any = {
				id: this.employeeId || this.store.user.employeeId
			};
			const task = await firstValueFrom(this.tasksService
				.createTask({
					title,
					organizationId: organizationId,
					members: [member],
					status: TaskStatusEnum.IN_PROGRESS,
					...(this.projectId ? { projectId: this.projectId } : {})
				}));
			this.tasks = this.tasks.concat(task);
			this.taskId = task.id;
		} catch (error) {
			this.toastrService.error(error);
		}
	};

	async getTasks() {
		if (this.employeeId) {
			this.tasks = await this.tasksService.getAllTasksByEmployee(
				this.employeeId,
				{
					where: {
						projectId: this.projectId
					}
				}
			);
		} else {
			const { items = [] } = await firstValueFrom(this.tasksService
				.getAllTasks({
					projectId: this.projectId
				}));
			this.tasks = items;
		}
	}

	ngOnDestroy() { }
}
