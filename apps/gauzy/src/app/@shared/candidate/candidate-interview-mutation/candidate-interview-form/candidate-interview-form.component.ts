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
import { Employee, IDateRange, ICandidateInterview } from '@gauzy/models';
import { EmployeesService } from '../../../../@core/services';
import { NbDialogService } from '@nebular/theme';
import { CandidateCalendarInfoComponent } from '../../candidate-calendar-info/candidate-calendar-info.component';

@Component({
	selector: 'ga-candidate-interview-form',
	templateUrl: 'candidate-interview-form.component.html',
	styleUrls: ['candidate-interview-form.component.scss']
})
export class CandidateInterviewFormComponent implements OnInit, OnDestroy {
	@Input() editData: ICandidateInterview;
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
			for (let i = 0; i < this.interviewNames.length; i++) {
				if (this.interviewNames[i] === item.title.toLocaleLowerCase()) {
					if (this.editData.title === this.form.get('title').value) {
						this.isTitleExisted = false;
						this.titleExist.emit(false);
						break;
					}
					this.isTitleExisted = true;
					this.titleExist.emit(true);
					break;
				} else {
					this.isTitleExisted = false;
					this.titleExist.emit(false);
				}
			}
		});
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
		this.interviewNames = [];
		this.interviewList.forEach((interview) => {
			this.interviewNames.push(interview.title.toLocaleLowerCase());
		});
		//if editing
		this.employeeIds = this.editData.interviewers
			? this.editData.interviewers.map((item) => item.employeeId)
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
