import { CandidateInterviewFormComponent } from './../candidate-interview-form/candidate-interview-form.component';
import {
	Component,
	OnInit,
	ViewChild,
	AfterViewInit,
	OnDestroy,
	Input
} from '@angular/core';
import { NbDialogRef, NbStepperComponent } from '@nebular/theme';
import { Candidate, ICandidateInterview, Employee } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { FormGroup } from '@angular/forms';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import { EmployeesService } from '../../../@core/services';
import { CandidateEmailComponent } from '../candidate-email/candidate-email.component';
import { CandidateInterviewersService } from '../../../@core/services/candidate-interviewers.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-candidate-interview-mutation',
	templateUrl: 'candidate-interview-mutation.component.html',
	styleUrls: ['candidate-interview-mutation.component.scss']
})
export class CandidateInterviewMutationComponent
	implements OnInit, AfterViewInit, OnDestroy {
	@Input() editData: ICandidateInterview;
	@Input() selectedCandidate: Candidate = null;
	@Input() interviewId = null;
	@Input() isCalendar: boolean;
	@Input() header: string;

	@ViewChild('stepper')
	stepper: NbStepperComponent;

	@ViewChild('candidateInterviewForm')
	candidateInterviewForm: CandidateInterviewFormComponent;

	@ViewChild('emailCandidateForm')
	emailCandidateForm: CandidateEmailComponent;

	@ViewChild('emailInterviewerForm')
	emailInterviewerForm: CandidateEmailComponent;

	form: FormGroup;
	candidateForm: FormGroup;
	interviewerForm: FormGroup;
	interview: any;
	private _ngDestroy$ = new Subject<void>();
	employees: Employee[] = [];
	candidates: Candidate[] = [];
	selectedInterviewers: string[];
	isCandidateNotification = false;
	isInterviewerNotification = false;
	emptyInterview = {
		title: '',
		interviewers: null,
		startTime: null,
		endTime: null,
		note: ''
	};
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewMutationComponent>,
		protected employeesService: EmployeesService,
		protected store: Store,
		private candidateInterviewService: CandidateInterviewService,
		protected candidatesService: CandidatesService,
		private errorHandler: ErrorHandlingService,
		private candidateInterviewersService: CandidateInterviewersService,
		readonly translateService: TranslateService
	) {}

	ngOnInit() {
		this.candidatesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidates) => {
				this.candidates = candidates.items;
			});
	}

	async ngAfterViewInit() {
		this.form = this.candidateInterviewForm.form;
		//if editing
		if (this.editData) {
			this.form.patchValue(this.editData);
			this.candidateInterviewForm.selectedRange.end = this.editData.endTime;
			this.candidateInterviewForm.selectedRange.start = this.editData.startTime;
		}
	}

	next() {
		this.candidateInterviewForm.loadFormData();
		const interviewForm = this.candidateInterviewForm.form.value;
		this.selectedInterviewers = interviewForm.interviewers;
		this.interview = {
			title: this.form.get('title').value,
			interviewers: interviewForm.interviewers,
			location: this.form.get('location').value,
			startTime: interviewForm.startTime,
			endTime: interviewForm.endTime,
			note: this.form.get('note').value
		};
		//	if editing
		if (interviewForm.interviewers === null) {
			interviewForm.interviewers = this.candidateInterviewForm.employeeIds;
		}
		this.getEmployees(interviewForm.interviewers);
	}

	async getEmployees(employeeIds: string[]) {
		try {
			for (const id of employeeIds) {
				this.employees.push(
					await this.employeesService.getEmployeeById(id, ['user'])
				);
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async save() {
		this.employees = [];
		this.notification();
		const interview: ICandidateInterview = null;
		let createdInterview = null;
		if (this.interviewId !== null) {
			this.editInterview();
		} else {
			createdInterview = this.createInterview(interview);
		}
		this.closeDialog(createdInterview);
	}

	async createInterview(interview: ICandidateInterview) {
		interview = await this.candidateInterviewService.create({
			...this.emptyInterview,
			candidateId: this.selectedCandidate.id
		});
		this.addInterviewers(interview.id, this.selectedInterviewers);

		//find interviewers for this interview
		const interviewers = await this.candidateInterviewersService.findByInterviewId(
			interview.id
		);
		try {
			const createdInterview = await this.candidateInterviewService.update(
				interview.id,
				{
					title: this.interview.title,
					interviewers: interviewers ? interviewers : null,
					location: this.interview.location,
					startTime: this.interview.startTime,
					endTime: this.interview.endTime,
					note: this.interview.note
				}
			);
			return createdInterview;
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async addInterviewers(interviewId: string, employeeIds: string[]) {
		try {
			await this.candidateInterviewersService.createBulk(
				interviewId,
				employeeIds
			);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async editInterview() {
		let deletedIds = [];
		let newIds = [];
		const oldIds = this.editData.interviewers.map(
			(item) => item.employeeId
		);
		if (this.interview.interviewers) {
			deletedIds = oldIds.filter(
				(item) => !this.interview.interviewers.includes(item)
			);
			newIds = this.interview.interviewers.filter(
				(item: string) => !oldIds.includes(item)
			);
		}
		try {
			await this.candidateInterviewService.update(this.interviewId, {
				...this.interview
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
		await this.candidateInterviewersService.deleteBulkByEmployeeId(
			deletedIds
		);
		this.addInterviewers(this.interviewId, newIds);
		this.interviewId = null;
	}

	async onCandidateSelected(id: string) {
		const candidate = await this.candidatesService.getCandidateById(id, [
			'user'
		]);
		this.selectedCandidate = candidate;
	}

	notification() {
		if (this.emailCandidateForm) {
			this.emailCandidateForm.loadFormData();
		}
		if (this.emailInterviewerForm) {
			this.emailInterviewerForm.loadFormData();
		}
	}

	closeDialog(interview: ICandidateInterview = null) {
		this.dialogRef.close(interview);
	}

	previous() {
		this.candidateInterviewForm.form.patchValue(this.interview);
		this.isCandidateNotification = false;
		this.isInterviewerNotification = false;
		this.employees = [];
	}

	checkedCandidate(checked: boolean) {
		this.isCandidateNotification = checked;
	}

	checkedInterviewer(checked: boolean) {
		this.isInterviewerNotification = checked;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
