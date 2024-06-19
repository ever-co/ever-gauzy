import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { ICandidateInterview, ICandidate, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	CandidateInterviewService,
	CandidateInterviewersService,
	CandidatesService,
	EmployeesService,
	ToastrService
} from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';
import { CandidateInterviewMutationComponent } from '../candidate-interview-mutation/candidate-interview-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-candidate-interview-info',
	templateUrl: './candidate-interview-info.component.html',
	styleUrls: ['./candidate-interview-info.component.scss']
})
export class CandidateInterviewInfoComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@Input() interviewId: any; //from calendar
	@Input() interviewList: ICandidateInterview[];
	@Input() isSlider: boolean;
	@Input() selectedCandidate: ICandidate; //from profile

	candidateId: string;
	interviewerNames = [];
	currentInterview: ICandidateInterview;
	nameList: string;
	timeUpdate: string;
	isNextBtn = true;
	index = 1;
	isPreviousBtn = false;
	interviewers = [];
	organization: IOrganization;

	constructor(
		private readonly dialogRef: NbDialogRef<CandidateInterviewInfoComponent>,
		private readonly candidateInterviewersService: CandidateInterviewersService,
		private readonly employeesService: EmployeesService,
		private readonly candidatesService: CandidatesService,
		private readonly dialogService: NbDialogService,
		public readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly candidateInterviewService: CandidateInterviewService,
		private readonly store: Store
	) {
		super(translateService);
	}

	async edit() {
		this.currentInterview.interviewers = this.interviewers;
		const dialog = this.dialogService.open(CandidateInterviewMutationComponent, {
			context: {
				headerTitle: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.EDIT_INTERVIEW'),
				editData: this.currentInterview,
				selectedCandidate: this.selectedCandidate,
				interviewId: this.currentInterview.id,
				interviews: this.interviewList
			}
		});
		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.toastrSuccess('UPDATED');
			this.loadData();
		}
	}
	async ngOnInit() {
		this.organization = this.store.selectedOrganization;
		if (this.interviewId) {
			const { id: organizationId, tenantId } = this.organization;
			const interviews = await this.candidateInterviewService.getAll(
				['interviewers', 'technologies', 'personalQualities', 'feedbacks'],
				{ organizationId, tenantId }
			);
			if (interviews) {
				this.interviewList = interviews.items;
				this.currentInterview = this.interviewList.find((item) => item.id === this.interviewId);

				const candidate = await this.candidatesService.getCandidateById(
					this.currentInterview.candidateId,
					['user'],
					{ organizationId, tenantId }
				);
				if (candidate) {
					this.selectedCandidate = candidate;
				}
			}
		} else {
			this.currentInterview = this.interviewList[0];
		}

		this.loadData();
	}

	loadData() {
		this.getData(this.currentInterview.id);
		this.setTime(this.currentInterview.updatedAt);
	}

	async getData(id: string) {
		const { id: organizationId, tenantId } = this.organization;
		const { items } = await firstValueFrom(this.employeesService.getAll(['user'], { organizationId, tenantId }));
		const employeeList = items;
		this.interviewerNames = [];
		this.interviewers = await this.candidateInterviewersService.findByInterviewId(id);
		if (this.interviewers) {
			for (const interviewer of this.interviewers) {
				employeeList.forEach((employee) => {
					if (interviewer.employeeId === employee.id) {
						this.interviewerNames.push(employee.user.firstName + ' ' + employee.user.lastName);
						this.nameList = this.interviewerNames.join(', ');
					}
				});
			}
		}
	}

	previous() {
		--this.index;
		this.isNextBtn = true;
		const currentIndex = this.interviewList.indexOf(this.currentInterview);
		const newIndex = currentIndex === 0 ? currentIndex : currentIndex - 1;
		this.currentInterview = this.interviewList[newIndex];
		this.loadData();
		if (currentIndex === 1) {
			this.isPreviousBtn = false;
		}
	}

	next() {
		++this.index;
		this.isPreviousBtn = true;
		const currentIndex = this.interviewList.indexOf(this.currentInterview);
		const newIndex = currentIndex === this.interviewList.length - 1 ? currentIndex : currentIndex + 1;
		this.currentInterview = this.interviewList[newIndex];
		this.loadData();
		if (currentIndex === this.interviewList.length - 2) {
			this.isNextBtn = false;
		}
	}

	setTime(time: any) {
		const now = new Date().getTime();
		const delta = (now - new Date(time).getTime()) / 1000;
		if (delta < 60) {
			this.timeUpdate = this.getTranslation('CANDIDATES_PAGE.INTERVIEW_INFO_MODAL.LESS_MINUTE');
		} else if (delta < 3600) {
			this.timeUpdate =
				Math.floor(delta / 60) + this.getTranslation('CANDIDATES_PAGE.INTERVIEW_INFO_MODAL.MINUTES_AGO');
		} else if (delta < 86400) {
			this.timeUpdate =
				Math.floor(delta / 3600) + this.getTranslation('CANDIDATES_PAGE.INTERVIEW_INFO_MODAL.HOURS_AGO');
		} else {
			this.timeUpdate =
				Math.floor(delta / 86400) + this.getTranslation('CANDIDATES_PAGE.INTERVIEW_INFO_MODAL.DAYS_AGO');
		}
	}

	isPastInterview(interview: ICandidateInterview) {
		const now = new Date().getTime();
		if (interview && new Date(interview.startTime).getTime() > now) {
			return false;
		} else {
			return true;
		}
	}

	private toastrSuccess(text: string) {
		this.toastrService.success(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {}
}
