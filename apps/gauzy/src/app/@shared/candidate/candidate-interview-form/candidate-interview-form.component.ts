import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Employee, IDateRange } from '@gauzy/models';
import { EmployeesService } from '../../../@core/services';
import { toUTC } from 'libs/utils';

@Component({
	selector: 'ga-candidate-interview-form',
	templateUrl: 'candidate-interview-form.component.html',
	styleUrls: ['candidate-interview-form.component.scss']
})
export class CandidateInterviewFormComponent implements OnInit, OnDestroy {
	form: any;
	employees: Employee[];

	selectedEmployeeIds: string[];
	select = true;
	selectedRange: IDateRange = { start: null, end: null };
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private readonly fb: FormBuilder,
		private employeeService: EmployeesService
	) {}

	ngOnInit() {
		this.loadFormData();
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
	}
	onMembersSelected(event) {
		this.selectedEmployeeIds = event;
	}
	loadFormData() {
		const startedAt = toUTC(this.selectedRange.start).toDate();
		const stoppedAt = toUTC(this.selectedRange.end).toDate();

		// console.log(startedAt);

		this.form = this.fb.group({
			title: [''],
			startTime: [startedAt],
			interviewers: [this.selectedEmployeeIds],
			endTime: [stoppedAt],
			location: [''],
			note: ['']
		});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
