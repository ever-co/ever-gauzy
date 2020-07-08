import {
	Component,
	OnInit,
	OnDestroy,
	ChangeDetectorRef,
	Input,
	Output,
	EventEmitter
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import {
	Employee,
	IDateRange,
	ICandidateInterviewers,
	ICandidateInterview
} from '@gauzy/models';
import { EmployeesService } from '../../../../@core/services';
import { NbDialogService } from '@nebular/theme';
import { CandidateCalendarInfoComponent } from '../../candidate-calendar-info/candidate-calendar-info.component';

@Component({
	selector: 'ga-candidate-interview-form',
	templateUrl: 'candidate-interview-form.component.html',
	styleUrls: ['candidate-interview-form.component.scss']
})
export class CandidateInterviewFormComponent implements OnInit, OnDestroy {
	@Input() interviewers: ICandidateInterviewers[];
	@Input() isCalendar: boolean;
	@Input() interviewList: ICandidateInterview[];
	@Output() titleExist = new EventEmitter<any>();

	yesterday = new Date();
	form: any;
	employees: Employee[];
	employeeIds: string[];
	isMeeting: boolean;
	interviewNames: string[];
	selectedEmployeeIds = null;
	isTitleExisted: boolean;
	selectedRange: IDateRange = { start: null, end: null };
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private readonly fb: FormBuilder,
		private dialogService: NbDialogService,
		private employeeService: EmployeesService,
		private cdRef: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.yesterday.setDate(this.yesterday.getDate() - 1);
		this.loadFormData();
		this.form.valueChanges.subscribe((item) => {
			this.interviewNames.forEach((el) => {
				this.isTitleExisted =
					el === item.title.toLocaleLowerCase() ? true : false;
				if (this.isTitleExisted) {
					this.titleExist.emit();
				}
			});
		});
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
		this.interviewNames = [];
		this.interviewList.forEach((tech) => {
			this.interviewNames.push(tech.title.toLocaleLowerCase());
		});

		//if editing
		this.employeeIds = this.interviewers
			? this.interviewers.map((item) => item.employeeId)
			: [];
	}
	async findTime() {
		const dialog = this.dialogService.open(CandidateCalendarInfoComponent);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.selectedRange = { start: data.startTime, end: data.endTime };
		}
	}

	onMembersSelected(event: string[]) {
		this.selectedEmployeeIds = event;
		const value = this.selectedEmployeeIds[0] ? true : null;
		this.form.patchValue({
			valid: value
		});
	}

	loadFormData() {
		this.form = this.fb.group({
			title: ['', Validators.required],
			startTime: [this.selectedRange.start],
			interviewers: [this.selectedEmployeeIds],
			endTime: [this.selectedRange.end],
			location: [''],
			note: [''],
			valid: [null, Validators.required]
		});
	}

	detectChanges(value: boolean) {
		if (value) {
			this.form.controls['location'].setValidators(Validators.required);
			this.cdRef.detectChanges();
		} else {
			this.form.controls['location'].clearValidators();
			this.form.patchValue({ location: '' });
		}
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
