import { Component, OnInit, Input } from '@angular/core';
import { Task } from '@gauzy/models';

@Component({
	selector: 'ga-sprint-task',
	templateUrl: './task.component.html',
	styleUrls: ['./task.component.css']
})
export class SprintTaskComponent implements OnInit {
	@Input() task: Task;
	constructor() {}

	ngOnInit(): void {}
}
