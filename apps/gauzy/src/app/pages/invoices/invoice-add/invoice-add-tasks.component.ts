import { Component, OnInit } from '@angular/core';
import { TasksService } from '../../../@core/services/tasks.service';
import { Task } from '@gauzy/models';
import { ViewCell } from 'ng2-smart-table';

@Component({
	template: `
		<ng-select
			[(items)]="tasks"
			bindName="title"
			placeholder="Select a Task"
			[(ngModel)]="selectedTask"
			(change)="selectTask($event)"
			[searchFn]="searchTask"
		>
			<ng-template ng-option-tmp let-item="item" let-index="index">
				{{ item.title }}
			</ng-template>
			<ng-template ng-label-tmp let-item="item">
				<div class="selector-template">
					<span>{{ item.title }}</span>
				</div>
			</ng-template>
		</ng-select>
	`,
	styles: []
})
export class InvoiceAddTasksComponent implements OnInit, ViewCell {
	tasks: Task[] = [];
	selectedTask: Task;

	constructor(private tasksService: TasksService) {}

	value: any;
	rowData: any;

	ngOnInit() {
		this.getTasks();
		this.selectedTask = this.rowData.selectedTask;
	}

	private async getTasks() {
		this.tasksService.getAllTasks().subscribe((data) => {
			this.tasks = data.items;
		});
	}

	selectTask($event) {
		this.rowData.task = $event;
	}

	searchTask(term: string, item: any) {
		if (item.title) {
			return item.title.toLowerCase().includes(term.toLowerCase());
		}
	}
}
