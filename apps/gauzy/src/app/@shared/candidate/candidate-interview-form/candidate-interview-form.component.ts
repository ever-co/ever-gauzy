import {
	Component,
	OnInit,
	OnDestroy,
	ChangeDetectorRef,
	Input
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
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
	@Input() interviewers: ICandidateInterviewers[];

	form: any;
	employees: Employee[];
	employeeIds: string[];
	isMeeting: boolean;
	selectedEmployeeIds = null;
	selectedRange: IDateRange = { start: null, end: null };
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private readonly fb: FormBuilder,
		private employeeService: EmployeesService,
		private cdRef: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.loadFormData();
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});

		//if editing
		this.employeeIds = this.interviewers
			? this.interviewers.map((item) => item.employeeId)
			: [];
	}
	findTime() {} //TO DO

	onMembersSelected(event: string[]) {
		this.selectedEmployeeIds = event;
	}

	loadFormData() {
		this.form = this.fb.group({
			title: [''],
			startTime: [this.selectedRange.start],
			interviewers: [this.selectedEmployeeIds],
			endTime: [this.selectedRange.end],
			location: [''],
			note: ['']
		});
	}

	detectChanges(value: boolean) {
		if (value) {
			this.form.controls['location'].setValidators(Validators.required);
			this.cdRef.detectChanges();
		} else {
			this.form.controls['location'].clearValidators();
			this.cdRef.detectChanges();
		}
	}
	resetLocation() {
		this.form.patchValue({ location: '' });
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
