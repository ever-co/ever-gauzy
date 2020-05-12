import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Employee, IDateRange, ICandidateInterviewers } from '@gauzy/models';
import { EmployeesService } from '../../../@core/services';

@Component({
	selector: 'ga-candidate-interview-form',
	templateUrl: 'candidate-interview-form.component.html',
	styleUrls: ['candidate-interview-form.component.scss']
})
export class CandidateInterviewFormComponent implements OnInit, OnDestroy {
	form: any;
	employees: Employee[];
	isMeeting: boolean;
	selectedEmployeeIds: ICandidateInterviewers[];
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
	findTime() {}
	onMembersSelected(event) {
		this.selectedEmployeeIds = event;
	}
	loadFormData() {
		this.form = this.fb.group({
			title: ['', Validators.required],
			startTime: [this.selectedRange.start],
			interviewers: [this.selectedEmployeeIds],
			endTime: [this.selectedRange.end],
			location: ['', [this.locationValidator]],
			note: ['']
		});
	}
	resetLocation() {
		this.form.patchValue({ location: '' });
	}
	locationValidator = (location: FormControl) => {
		if (this.isMeeting) {
			return location.setValidators(Validators.required);
		} else {
			return location.clearValidators();
		}
	};
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
