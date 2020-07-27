import { Component, OnInit, OnDestroy, Input, forwardRef } from '@angular/core';
import { Subject } from 'rxjs';
import { TasksService } from '../../../@core/services/tasks.service';
import { Task } from '@gauzy/models';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

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
	tasks: Task[];

	private _ngDestroy$ = new Subject<void>();
	private _projectId;

	onChange: any = () => {};
	onTouched: any = () => {};
	val: any;

	@Input() disabled = false;

	@Input()
	public get projectId() {
		return this._projectId;
	}
	public set projectId(value) {
		this._projectId = value;
		this.loadTasks();
	}

	set taskId(val: string) {
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
		this.val = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get taskId() {
		// this value is updated by programmatic changes if( val !== undefined && this.val !== val){
		return this.val;
	}

	constructor(private tasksService: TasksService) {}

	ngOnInit() {}

	private async loadTasks(): Promise<void> {
		const { items = [] } = await this.tasksService
			.getAllTasks({ projectId: this.projectId })
			.toPromise();

		this.tasks = items;

		if (
			items.length === 0 ||
			items.find((item) => this.taskId !== item.id)
		) {
			this.taskId = null;
		}
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

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
