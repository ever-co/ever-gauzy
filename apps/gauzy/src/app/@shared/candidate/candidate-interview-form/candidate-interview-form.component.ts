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
import { Employee, IDateRange, ICandidateInterview } from '@gauzy/models';
import { EmployeesService } from '../../../@core/services';

@Component({
	selector: 'ga-candidate-interview-form',
	templateUrl: 'candidate-interview-form.component.html',
	styleUrls: ['candidate-interview-form.component.scss']
})
export class CandidateInterviewFormComponent implements OnInit, OnDestroy {
	constructor(
		private readonly fb: FormBuilder,
		private employeeService: EmployeesService,
		private cdRef: ChangeDetectorRef
	) {}
	@Input() employeeIds: string[];
	form: any;
	employees: Employee[];
	isMeeting: boolean;
	selectedEmployeeIds: string[];
	select = true;
	selectedRange: IDateRange = { start: null, end: null };
	private _ngDestroy$ = new Subject<void>();

	unic;

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
	uniqIds(arr: string[]) {
		const result = [];
		for (const id of arr) {
			if (!result.includes(id)) {
				result.push(id);
			}
			return result;
		}
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
	resetLocation() {
		this.form.patchValue({ location: '' });
	}
	detectChanges(value) {
		if (value) {
			this.form.controls['location'].setValidators(Validators.required);
			this.cdRef.detectChanges();
		} else {
			this.form.controls['location'].clearValidators();
			// this.cdRef.detectChanges();
		}
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
