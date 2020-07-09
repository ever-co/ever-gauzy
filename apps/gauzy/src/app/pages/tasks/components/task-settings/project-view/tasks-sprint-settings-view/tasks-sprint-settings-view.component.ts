import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

@Component({
	selector: 'ngx-tasks-sprint-settings-view',
	templateUrl: './tasks-sprint-settings-view.component.html',
	styleUrls: ['./tasks-sprint-settings-view.component.css']
})
export class TasksSprintSettingsViewComponent implements OnInit {
	form: FormGroup;
	sprints: any[] = [
		{
			name: 'Sprint 1'
		}
	];

	sprintLengths: any = Array.from(Array(10), (_, i) => ({ value: i + 1 }));
	sprintDayStart: any = [
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday'
	].map((name: string, index: number) => ({ value: index, name }));

	constructor(private fb: FormBuilder) {}

	ngOnInit(): void {
		this.loadFormData();
	}

	private loadFormData() {
		this.form = this.fb.group({
			sprintLength: [''],
			sprintDayStart: ['']
		});
	}

	submit(evt): void {
		console.log(evt);
	}
}
