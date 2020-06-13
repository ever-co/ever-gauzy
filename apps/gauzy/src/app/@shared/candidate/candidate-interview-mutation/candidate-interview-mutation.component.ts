import { CandidateInterviewFormComponent } from './candidate-interview-form/candidate-interview-form.component';
import {
	Component,
	OnInit,
	ViewChild,
	AfterViewInit,
	OnDestroy,
	Input,
	ChangeDetectorRef
} from '@angular/core';
import { NbDialogRef, NbStepperComponent } from '@nebular/theme';
import {
	Candidate,
	ICandidateInterview,
	Employee,
	IDateRange,
	ICandidatePersonalQualities,
	ICandidateTechnologies
} from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { FormGroup } from '@angular/forms';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { first } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { Subject } from 'rxjs';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import { EmployeesService } from '../../../@core/services';
import { CandidateInterviewersService } from '../../../@core/services/candidate-interviewers.service';
import { CandidateCriterionsFormComponent } from './candidate-criterions-form /candidate-criterions-form.component';
import { CandidateTechnologiesService } from '../../../@core/services/candidate-technologies.service';
import { CandidatePersonalQualitiesService } from '../../../@core/services/candidate-personal-qualities.service';

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
	@Input() selectedRangeCalendar: IDateRange;

	@Input() header: string;

	@ViewChild('stepper')
	stepper: NbStepperComponent;

	@ViewChild('candidateCriterionsForm')
	candidateCriterionsForm: CandidateCriterionsFormComponent;

	@ViewChild('candidateInterviewForm')
	candidateInterviewForm: CandidateInterviewFormComponent;

	@ViewChild('candidateNotificationForm')
	candidateNotificationForm: CandidateInterviewFormComponent;

	form: FormGroup;
	candidateForm: FormGroup;
	interviewerForm: FormGroup;
	interview: any;
	private _ngDestroy$ = new Subject<void>();
	employees: Employee[] = [];
	candidates: Candidate[] = [];
	selectedInterviewers: string[];
	criterionsId = null;
	emptyInterview = {
		title: '',
		interviewers: null,
		startTime: null,
		endTime: null,
		criterions: null,
		note: ''
	};
	personalQualities: ICandidatePersonalQualities[] = null;
	technologies: ICandidateTechnologies[];
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewMutationComponent>,
		protected employeesService: EmployeesService,
		protected store: Store,
		private cdRef: ChangeDetectorRef,
		private candidateInterviewService: CandidateInterviewService,
		protected candidatesService: CandidatesService,
		private errorHandler: ErrorHandlingService,
		private candidateInterviewersService: CandidateInterviewersService,
		private candidateTechnologiesService: CandidateTechnologiesService,
		private candidatePersonalQualitiesService: CandidatePersonalQualitiesService
	) {}

	async ngOnInit() {
		const { items } = await this.candidatesService
			.getAll(['user'])
			.pipe(first())
			.toPromise();
		this.candidates = items;
	}

	async ngAfterViewInit() {
		this.form = this.candidateInterviewForm.form;
		//if editing
		if (this.editData) {
			this.form.patchValue(this.editData);
			this.form.patchValue({ valid: true });
			this.cdRef.detectChanges();
			this.candidateInterviewForm.selectedRange.end = this.editData.endTime;
			this.candidateInterviewForm.selectedRange.start = this.editData.startTime;
		}
		if (this.selectedRangeCalendar) {
			this.candidateInterviewForm.selectedRange.end = this.selectedRangeCalendar.end;
			this.candidateInterviewForm.selectedRange.start = this.selectedRangeCalendar.start;
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
		const interview: ICandidateInterview = null;
		let createdInterview = null;
		if (this.interviewId !== null) {
			createdInterview = this.editInterview();
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
		this.addCriterions(interview.id);
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
					// TO DO
					// technologies:
					personalQualities: this.personalQualities,
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
	async addCriterions(interviewId: string) {
		this.candidateCriterionsForm.loadFormData();
		const criterionsForm = this.candidateCriterionsForm.form.value;
		// TO DO
		await this.candidateTechnologiesService.createBulk(
			interviewId,
			criterionsForm.selectedTechnologies
		);
		this.personalQualities = await this.candidatePersonalQualitiesService.createBulk(
			interviewId,
			criterionsForm.selectedQualities
		);
	}
	async editInterview() {
		let deletedIds = [];
		let newIds = [];
		let updatedInterview;
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
			updatedInterview = await this.candidateInterviewService.update(
				this.interviewId,
				{
					...this.interview
				}
			);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
		await this.candidateInterviewersService.deleteBulkByEmployeeId(
			deletedIds
		);
		this.addInterviewers(this.interviewId, newIds);
		this.interviewId = null;
		return updatedInterview;
	}

	async onCandidateSelected(id: string) {
		const candidate = await this.candidatesService.getCandidateById(id, [
			'user'
		]);
		this.selectedCandidate = candidate;
	}

	closeDialog(interview: ICandidateInterview = null) {
		this.dialogRef.close(interview);
	}

	previous() {
		this.candidateInterviewForm.form.patchValue(this.interview);
		this.candidateInterviewForm.form.patchValue({ valid: true });
		this.employees = [];
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
