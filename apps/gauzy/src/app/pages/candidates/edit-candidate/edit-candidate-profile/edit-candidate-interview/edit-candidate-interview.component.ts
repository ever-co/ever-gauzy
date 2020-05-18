import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { CandidateInterviewMutationComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { first, takeUntil } from 'rxjs/operators';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { FormGroup } from '@angular/forms';
import { Candidate, Employee, ICandidateInterview } from '@gauzy/models';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { CandidateInterviewersService } from 'apps/gauzy/src/app/@core/services/candidate-interviewers.service';

@Component({
	selector: 'ga-edit-candidate-interview',
	templateUrl: './edit-candidate-interview.component.html',
	styleUrls: ['./edit-candidate-interview.component.scss']
})
export class EditCandidateInterviewComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	interviewList: ICandidateInterview[];
	candidateId: string;
	selectedCandidate: Candidate;
	employees: Employee[];
	form: FormGroup;
	interviewResult: any;
	constructor(
		private dialogService: NbDialogService,
		translate: TranslateService,
		protected employeesService: EmployeesService,
		private readonly candidateInterviewService: CandidateInterviewService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private candidateInterviewersService: CandidateInterviewersService,
		private toastrService: NbToastrService
	) {
		super(translate);
	}
	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this.loadInterview();
				}
				this.selectedCandidate = candidate;
			});
	}

	async add() {
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					header: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'
					),
					selectedCandidate: this.selectedCandidate
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('CREATED');
			this.loadInterview();
		}
	}
	private async loadInterview() {
		this.interviewResult = await this.candidateInterviewService.getAll(
			['interviewers'],
			{ candidateId: this.candidateId }
		);
		if (this.interviewResult) {
			this.interviewList = this.interviewResult.items;
		}
	}
	async editInterview(id: string) {
		const currentInterview = await this.candidateInterviewService.findById(
			id
		);
		currentInterview.interviewers = await this.candidateInterviewersService.findByInterviewId(
			id
		);
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					header: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.EDIT_INTERVIEW'
					),
					editData: currentInterview,
					selectedCandidate: this.selectedCandidate,
					interviewId: id
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('UPDATED');
			this.loadInterview();
		}
	}
	async removeInterview(id: string) {
		try {
			await this.candidateInterviewService.delete(id);
			await this.candidateInterviewersService.deleteByInterviewId(id);
			this.toastrSuccess('DELETED');
			this.loadInterview();
		} catch (error) {
			this.toastrError(error);
		}
	}
	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`)
		);
	}
	private toastrError(error) {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.ERROR', {
				error: error.error ? error.error.message : error.message
			}),
			this.getTranslation('TOASTR.TITLE.ERROR')
		);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
