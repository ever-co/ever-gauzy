import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { Task } from '@gauzy/models';

@Component({
	selector: 'ga-sprint-task',
	templateUrl: './task.component.html',
	styleUrls: ['./task.component.css']
})
export class SprintTaskComponent implements OnInit {
	@Input() task: Task;
	@Output() toggleItemEvent: EventEmitter<any> = new EventEmitter();
	constructor() {}

	ngOnInit(): void {}

	toggleItem(item: Task): void {
		this.toggleItemEvent.emit(item);
	}
}
