import { CandidateInterviewFormComponent } from './../candidate-interview-form/candidate-interview-form.component';
import {
	Component,
	OnInit,
	ViewChild,
	AfterViewInit,
	OnDestroy,
	Input
} from '@angular/core';
import {
	NbDialogRef,
	NbToastrService,
	NbStepperComponent
} from '@nebular/theme';
import {
	Candidate,
	ICandidateInterviewCreateInput,
	ICandidateInterview,
	Employee
} from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { FormGroup } from '@angular/forms';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { first, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import { EmployeesService } from '../../../@core/services';
import { CandidateEmailComponent } from '../candidate-email/candidate-email.component';

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

	@ViewChild('stepper')
	stepper: NbStepperComponent;

	@ViewChild('candidateInterviewForm')
	candidateInterviewForm: CandidateInterviewFormComponent;

	@ViewChild('emailCandidateForm')
	emailCandidateForm: CandidateEmailComponent;

	@ViewChild('emailInterviewerForm')
	emailInterviewerForm: CandidateEmailComponent;

	form: FormGroup;
	formInvalid = false;
	candidateForm: FormGroup;
	interviewerForm: FormGroup;
	interview: ICandidateInterviewCreateInput;
	private _ngDestroy$ = new Subject<void>();
	employees: Employee[] = [];
	candidates: Candidate[] = [];
	selectedCandidateId = null;
	isCandidateNotification = false;
	isInterviewerNotification = false;
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewMutationComponent>,
		protected employeesService: EmployeesService,
		protected toastrService: NbToastrService,
		protected store: Store,
		private candidateInterviewService: CandidateInterviewService,
		protected candidatesService: CandidatesService,
		private errorHandler: ErrorHandlingService
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
			this.candidateInterviewForm.form.patchValue(this.editData);
			this.candidateInterviewForm.selectedRange.end = this.editData.endTime;
			this.candidateInterviewForm.selectedRange.start = this.editData.startTime;
		}
	}
	closeDialog(interview: ICandidateInterview = null) {
		this.dialogRef.close(interview);
	}
	async onCandidateSelected(id: string) {
		if (this.selectedCandidate === null) {
			const res = await this.candidatesService
				.getAll(['user'], {
					id: id
				})
				.pipe(first())
				.toPromise();
			this.selectedCandidate = res.items[0]; //to do
		}
	}
	next() {
		this.candidateInterviewForm.loadFormData();
		const interviewForm = this.candidateInterviewForm.form.value;

		//if editing
		if (interviewForm.interviewers === null) {
			interviewForm.interviewers = this.candidateInterviewForm.employeeIds;
		}

		this.interview = {
			title: this.form.get('title').value,
			interviewers: interviewForm.interviewers,
			location: this.form.get('location').value,
			startTime: interviewForm.startTime,
			endTime: interviewForm.endTime,
			note: this.form.get('note').value
		};

		this.getEmployeeInfo(interviewForm.interviewers);
	}

	async getEmployeeInfo(employeeIds: string[]) {
		for (let i = 0; i < employeeIds.length; i++) {
			try {
				const res = await this.employeesService
					.getAll(['user'], { id: employeeIds[i] })
					.pipe(first())
					.toPromise();
				this.employees.push(res.items[0]);
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	notification() {
		if (this.emailCandidateForm) {
			this.emailCandidateForm.loadFormData();
			// const emailCandidateForm = this.emailCandidateForm.form.value;
		}

		if (this.emailInterviewerForm) {
			this.emailInterviewerForm.loadFormData();
			// const emailInterviewerForm = this.emailInterviewerForm.form.value;
		}
	}
	async add() {
		this.employees = [];
		this.next();
		this.notification();
		let interview: ICandidateInterview;
		try {
			if (this.interviewId !== null) {
				// editing interview
				interview = await this.candidateInterviewService.update(
					this.interviewId,
					{ ...this.interview }
				);
				this.interviewId = null;
			} else {
				// creating interview
				interview = await this.candidateInterviewService.create({
					...this.interview,
					candidateId: this.selectedCandidate.id
				});
			}
			this.closeDialog(interview);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}
	previous() {
		this.candidateInterviewForm.form.patchValue(this.interview);
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
