import {
	Component,
	OnInit,
	OnDestroy,
	ChangeDetectorRef,
	Input,
	Output,
	EventEmitter,
	AfterViewInit
} from '@angular/core';
import { UntypedFormBuilder, Validators } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import moment from 'moment';
import { IEmployee, IDateRange, ICandidateInterview, IOrganization } from '@gauzy/contracts';
import { EmployeesService } from '@gauzy/ui-core/core';
import { NbDialogService } from '@nebular/theme';
import { CandidateCalendarInfoComponent } from '../../candidate-calendar-info/candidate-calendar-info.component';
import { firstValueFrom } from 'rxjs';
import { Store } from '@gauzy/ui-core/common';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-candidate-interview-form',
	templateUrl: 'candidate-interview-form.component.html',
	styleUrls: ['candidate-interview-form.component.scss']
})
export class CandidateInterviewFormComponent implements AfterViewInit, OnInit, OnDestroy {
	@Input() editData: ICandidateInterview;
	@Input() isCalendar: boolean;
	@Output() titleExist = new EventEmitter<any>();

	/*
	 * Getter & Setter for interviews
	 */
	_interviews: ICandidateInterview[] = [];
	get interviews(): ICandidateInterview[] {
		return this._interviews;
	}
	@Input() set interviews(value: ICandidateInterview[]) {
		this._interviews = value;
	}

	yesterday = moment().subtract(1, 'days').toDate();
	form: any;
	employees: IEmployee[] = [];
	employeeIds: string[] = [];
	isMeeting: boolean;
	interviewNames: string[] = [];
	selectedEmployeeIds = null;
	isTitleExisted: boolean;
	selectedRange: IDateRange = { start: null, end: null };
	organization: IOrganization;

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly dialogService: NbDialogService,
		private readonly employeeService: EmployeesService,
		private readonly cdRef: ChangeDetectorRef,
		private readonly store: Store
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.loadEmployees()),
				tap(() => this.loadInterviewNames()),
				untilDestroyed(this)
			)
			.subscribe();
		this.loadFormData();

		//if editing
		if (this.editData) {
			this.employeeIds = this.editData.interviewers
				? this.editData.interviewers.map((item) => item.employeeId)
				: [];
		}
	}

	ngAfterViewInit() {
		this.form.get('title').valueChanges.subscribe((title: string) => {
			for (let i = 0; i < this.interviewNames.length; i++) {
				if (this.interviewNames[i] === title.toLocaleLowerCase()) {
					if (this.editData && this.editData.title === this.form.get('title').value) {
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
	}

	async loadEmployees() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.employeeService
			.getAll(['user'], { organizationId, tenantId })
			.pipe(
				tap(({ items }) => (this.employees = items)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	loadInterviewNames() {
		this.interviewNames = [];
		this.interviews.forEach((interview) => {
			this.interviewNames.push(interview.title.toLocaleLowerCase());
		});
	}

	async findTime() {
		const dialog = this.dialogService.open(CandidateCalendarInfoComponent);
		const data = await firstValueFrom(dialog.onClose);
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

	ngOnDestroy() {}
}
