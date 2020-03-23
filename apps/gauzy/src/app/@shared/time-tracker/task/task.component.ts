import { Component, OnInit, OnDestroy, Input, forwardRef } from '@angular/core';
import { Subject } from 'rxjs';
import { TasksService } from '../../../@core/services/tasks.service';
import { Task } from '@gauzy/models';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
	selector: 'ga-task-selector',
	templateUrl: './task.component.html',
	styleUrls: ['./task.component.scss'],
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

	//@Output() change:EventEmitter<string> = new EventEmitter();

	private _ngDestroy$ = new Subject<void>();

	onChange: any = () => {};
	onTouched: any = () => {};
	val: any;

	@Input() disabled = false;

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

	ngOnInit() {
		this.loadTasks();
	}

	private async loadTasks(): Promise<void> {
		const {
			items = []
		} = await this.tasksService.getAllTasks().toPromise();

		this.tasks = items;
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
	// onChange($event:string) {
	// 	this.change.emit($event);
	// }
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
