import {
	Component,
	OnInit,
	ViewChild,
	AfterViewInit,
	OnDestroy,
	Input,
	ChangeDetectorRef
} from '@angular/core';
import { Router } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { NbDialogRef, NbStepperComponent } from '@nebular/theme';
import {
	ICandidate,
	ICandidateInterview,
	IEmployee,
	IDateRange,
	ICandidatePersonalQualities,
	ICandidateTechnologies,
	IOrganization
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import {
	CandidateInterviewersService,
	CandidateInterviewService,
	CandidatePersonalQualitiesService,
	CandidatesService,
	CandidateStore,
	CandidateTechnologiesService,
	EmployeesService,
	ErrorHandlingService,
	Store
} from '../../../@core/services';
import { CandidateCriterionsFormComponent } from './candidate-criterions-form/candidate-criterions-form.component';
import { CandidateInterviewFormComponent } from './candidate-interview-form/candidate-interview-form.component';
import { CandidateNotificationFormComponent } from './candidate-notification-form/candidate-notification-form.component';

@Component({
	selector: 'ga-candidate-interview-mutation',
	templateUrl: 'candidate-interview-mutation.component.html',
	styleUrls: ['candidate-interview-mutation.component.scss']
})
export class CandidateInterviewMutationComponent
	implements OnInit, AfterViewInit, OnDestroy {

	@Input() editData: ICandidateInterview;
	@Input() selectedCandidate: ICandidate = null;
	@Input() interviewId = null;
	@Input() isCalendar: boolean;
	@Input() selectedRangeCalendar: IDateRange;
	@Input() header: string;
	@Input() interviewList: ICandidateInterview[] = [];

	@ViewChild('stepper')
	stepper: NbStepperComponent;

	@ViewChild('candidateCriterionsForm')
	candidateCriterionsForm: CandidateCriterionsFormComponent;

	@ViewChild('candidateInterviewForm')
	candidateInterviewForm: CandidateInterviewFormComponent;

	@ViewChild('candidateNotificationForm')
	candidateNotificationForm: CandidateNotificationFormComponent;

	form: FormGroup;
	candidateForm: FormGroup;
	interviewerForm: FormGroup;
	interview: any;
	employees: IEmployee[] = [];
	candidates: ICandidate[] = [];
	selectedInterviewers: string[];
	criterionsId = null;
	isTitleExist = false;
	interviewNames: string[];
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
	selectedCandidateId: string;
	selectedOrganization: IOrganization;

	constructor(
		protected readonly dialogRef: NbDialogRef<CandidateInterviewMutationComponent>,
		protected readonly employeesService: EmployeesService,
		protected readonly store: Store,
		private readonly cdRef: ChangeDetectorRef,
		private readonly candidateInterviewService: CandidateInterviewService,
		protected readonly candidatesService: CandidatesService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly candidateInterviewersService: CandidateInterviewersService,
		private readonly candidateTechnologiesService: CandidateTechnologiesService,
		private readonly candidatePersonalQualitiesService: CandidatePersonalQualitiesService,
		private readonly router: Router,
		private readonly candidateStore: CandidateStore
	) {}

	async ngOnInit() {
		if (this.interviewList.length > 0) {
			this.interviewNames = [];
			this.interviewList.forEach((interview) => {
				this.interviewNames.push(interview.title.toLocaleLowerCase());
			});
		}
		this.selectedOrganization = this.store.selectedOrganization;
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { items = [] } = await this.candidatesService
			.getAll(['user'], { organizationId, tenantId })
			.pipe(first())
			.toPromise();
		this.candidates = items;
	}

	titleExist(value: boolean) {
		this.isTitleExist = value;
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
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { items } = await this.employeesService
			.getAll(['user'], { organizationId, tenantId })
			.pipe(first())
			.toPromise();
		const employeeList = items;
		employeeIds.forEach((id) => {
			employeeList.forEach((item) => {
				if (id === item.id) {
					this.employees.push(item);
				}
			});
		});
	}

	async save() {
		this.employees = [];
		const interview: ICandidateInterview = null;
		let createdInterview = null;
		if (this.interviewId !== null) {
			createdInterview = this.editInterview();
		} else {
			createdInterview = await this.createInterview(interview);
			this.candidateStore.loadInterviews(createdInterview);
		}
		this.closeDialog(createdInterview);
	}

	async createInterview(interview: ICandidateInterview) {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		interview = await this.candidateInterviewService.create({
			...this.emptyInterview,
			candidateId: this.selectedCandidate.id,
			organizationId,
			tenantId
		});
		this.addInterviewers(interview.id, this.selectedInterviewers);
		this.candidateCriterionsForm.loadFormData();
		const criterionsForm = this.candidateCriterionsForm.form.value;
		this.addCriterions(
			interview.id,
			criterionsForm.selectedTechnologies,
			criterionsForm.selectedQualities
		);
		try {
			const createdInterview = await this.candidateInterviewService.update(
				interview.id,
				{
					title: this.interview.title,
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
			const { id: organizationId, tenantId } = this.selectedOrganization;
			await this.candidateInterviewersService.createBulk({
				interviewId,
				employeeIds,
				organizationId,
				tenantId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async addCriterions(interviewId: string, tech?: string[], qual?: string[]) {
		try {
			this.technologies = await this.candidateTechnologiesService.createBulk(
				interviewId,
				tech
			);
			this.personalQualities = await this.candidatePersonalQualitiesService.createBulk(
				interviewId,
				qual
			);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
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
			this.updateCriterions(
				this.editData.personalQualities,
				this.editData.technologies
			);
			updatedInterview = await this.candidateInterviewService.update(
				this.interviewId,
				{
					title: this.interview.title,
					location: this.interview.location,
					startTime: this.interview.startTime,
					endTime: this.interview.endTime,
					note: this.interview.note
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

	async updateCriterions(
		qual: ICandidatePersonalQualities[],
		tech: ICandidateTechnologies[]
	) {
		this.candidateCriterionsForm.loadFormData();
		const criterionsForm = this.candidateCriterionsForm.form.value;
		const techCriterions = this.setCriterions(
			tech,
			criterionsForm.selectedTechnologies
		);
		const qualCriterions = this.setCriterions(
			qual,
			criterionsForm.selectedQualities
		);
		//CREATE NEW
		if (techCriterions.createInput) {
			try {
				await this.candidateTechnologiesService.createBulk(
					this.editData.id,
					techCriterions.createInput
				);
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
		if (qualCriterions.createInput) {
			try {
				await this.candidatePersonalQualitiesService.createBulk(
					this.editData.id,
					qualCriterions.createInput
				);
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
		//DELETE OLD
		if (techCriterions.deleteInput.length > 0) {
			try {
				await this.candidateTechnologiesService.deleteBulkByInterviewId(
					this.editData.id,
					techCriterions.deleteInput
				);
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
		if (qualCriterions.deleteInput.length > 0) {
			try {
				await this.candidatePersonalQualitiesService.deleteBulkByInterviewId(
					this.editData.id,
					qualCriterions.deleteInput
				);
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	setCriterions(
		data: ICandidateTechnologies[] | ICandidatePersonalQualities[],
		selectedItems: string[]
	) {
		const createInput = [];
		const deleteInput = [];
		const dataName = [];
		if (selectedItems) {
			data.forEach((item) => dataName.push(item.name));
			selectedItems.forEach((item) =>
				dataName.includes(item) ? item : createInput.push(item)
			);
			data.forEach((item) =>
				!selectedItems.includes(item.name)
					? item
					: deleteInput.push(item)
			);
			return { createInput: createInput, deleteInput: deleteInput };
		}
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

	route() {
		this.dialogRef.close();
		this.router.navigate([
			'/pages/employees/candidates/interviews/criterion'
		]);
	}

	ngOnDestroy() {}
}
