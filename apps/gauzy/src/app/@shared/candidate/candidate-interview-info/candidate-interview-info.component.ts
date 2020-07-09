import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService, NbToastrService } from '@nebular/theme';
import { ICandidateInterview, Candidate } from '@gauzy/models';
import { CandidateInterviewersService } from '../../../@core/services/candidate-interviewers.service';
import { EmployeesService } from '../../../@core/services';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { CandidateInterviewMutationComponent } from '../candidate-interview-mutation/candidate-interview-mutation.component';
import { first } from 'rxjs/operators';
import { Subject } from 'rxjs';
@Component({
	selector: 'ga-candidate-interview-info',
	templateUrl: './candidate-interview-info.component.html',
	styleUrls: ['./candidate-interview-info.component.scss']
})
export class CandidateInterviewInfoComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() interviewId: any; //from calendar
	@Input() selectedCandidate: Candidate; //from profile
	private _ngDestroy$ = new Subject<void>();
	candidateId: string;
	interviewerNames = [];
	currentInterview: ICandidateInterview;
	nameList: string;
	timeUpdate: string;
	isNextBtn = true;
	interviewList: ICandidateInterview[];
	index = 1;
	isPreviousBtn = false;
	interviewers = [];
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewInfoComponent>,
		private candidateInterviewersService: CandidateInterviewersService,
		private employeesService: EmployeesService,
		private candidatesService: CandidatesService,
		private dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private candidateInterviewService: CandidateInterviewService
	) {
		super(translateService);
	}
	async edit() {
		this.currentInterview.interviewers = this.interviewers;
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					header: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.EDIT_INTERVIEW'
					),
					editData: this.currentInterview,
					selectedCandidate: this.selectedCandidate,
					interviewId: this.currentInterview.id,
					interviewList: this.interviewList
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('UPDATED');
			this.loadData();
		}
	}
	async ngOnInit() {
		if (this.interviewId) {
			const interviews = await this.candidateInterviewService.getAll([
				'interviewers',
				'technologies',
				'personalQualities',
				'feedbacks'
			]);
			if (interviews) {
				this.interviewList = interviews.items;
				this.currentInterview = this.interviewList.find(
					(item) => item.id === this.interviewId
				);
				this.interviewList = [];
				const candidate = await this.candidatesService.getCandidateById(
					this.currentInterview.candidateId,
					['user']
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
		this.interviewerNames = [];
		this.interviewers = await this.candidateInterviewersService.findByInterviewId(
			id
		);
		if (this.interviewers) {
			for (const interviewer of this.interviewers) {
				const employee = await this.employeesService.getEmployeeById(
					interviewer.employeeId,
					['user']
				);
				if (employee) {
					this.interviewerNames.push(
						employee.user.firstName + ' ' + employee.user.lastName
					);
					this.nameList = this.interviewerNames.join(', ');
				}
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
		const newIndex =
			currentIndex === this.interviewList.length - 1
				? currentIndex
				: currentIndex + 1;
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
			this.timeUpdate = this.getTranslation(
				'CANDIDATES_PAGE.INTERVIEW_INFO_MODAL.LESS_MINUTE'
			);
		} else if (delta < 3600) {
			this.timeUpdate =
				Math.floor(delta / 60) +
				this.getTranslation(
					'CANDIDATES_PAGE.INTERVIEW_INFO_MODAL.MINUTES_AGO'
				);
		} else if (delta < 86400) {
			this.timeUpdate =
				Math.floor(delta / 3600) +
				this.getTranslation(
					'CANDIDATES_PAGE.INTERVIEW_INFO_MODAL.HOURS_AGO'
				);
		} else {
			this.timeUpdate =
				Math.floor(delta / 86400) +
				this.getTranslation(
					'CANDIDATES_PAGE.INTERVIEW_INFO_MODAL.DAYS_AGO'
				);
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
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`)
		);
	}
	closeDialog() {
		this.dialogRef.close();
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
