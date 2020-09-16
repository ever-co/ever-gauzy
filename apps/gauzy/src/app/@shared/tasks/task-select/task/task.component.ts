import { Component, OnInit, OnDestroy, Input, forwardRef } from '@angular/core';
import { ITask } from '@gauzy/models';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { TasksService } from '../../../../@core/services/tasks.service';
import { NbDialogService } from '@nebular/theme';
import { AddTaskDialogComponent } from '../../add-task-dialog/add-task-dialog.component';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs';

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
	implements OnInit, OnDestroy, ControlValueAccessor {
	private _employeeId;
	private _projectId;

	@Input() disabled = false;
	@Input() allowAddNew = true;

	@Input()
	public get projectId() {
		return this._projectId;
	}
	public set projectId(value) {
		this._projectId = value;
		this.loadTasks$.next();
	}

	@Input()
	public get employeeId() {
		return this._employeeId;
	}
	public set employeeId(value) {
		this._employeeId = value;
		this.loadTasks$.next();
	}

	set taskId(val: string) {
		this.val = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get taskId() {
		return this.val;
	}

	tasks: ITask[];
	val: any;
	loadTasks$: Subject<any> = new Subject();

	constructor(
		private tasksService: TasksService,
		private dialogService: NbDialogService
	) {}

	onChange: any = () => {};
	onTouched: any = () => {};

	ngOnInit() {
		this.loadTasks$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(async () => {
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
					const { items = [] } = await this.tasksService
						.getAllTasks({
							projectId: this.projectId
						})
						.toPromise();

					this.tasks = items;
				}
			});
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

	createNew = (name: string) => {
		this.dialogService
			.open(AddTaskDialogComponent, {
				context: {
					createTask: true,
					task: {
						title: name,
						projectId: this.projectId
					}
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((task) => {
				if (task) {
					this.tasks = this.tasks.concat(task);
					this.taskId = task.id;
				}
			});
	};

	ngOnDestroy() {}
}
