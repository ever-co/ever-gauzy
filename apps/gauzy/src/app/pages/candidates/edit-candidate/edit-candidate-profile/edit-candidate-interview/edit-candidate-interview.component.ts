import { ICandidateInterview } from './../../../../../../../../../libs/models/src/lib/candidate-interview.model';
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
import { Candidate } from '@gauzy/models';

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
	interviewId = null;
	form: FormGroup;
	constructor(
		private dialogService: NbDialogService,
		translate: TranslateService,
		private readonly candidateInterviewService: CandidateInterviewService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
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
			CandidateInterviewMutationComponent
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrService.success('Interview has been added', 'Success');
			this.loadInterview();
		}
	}
	private async loadInterview() {
		const res = await this.candidateInterviewService.getAll({
			candidateId: this.candidateId
		});
		if (res) {
			this.interviewList = res.items;
		}
	}
	editInterview(index: number, id: string) {
		this.interviewId = id;
	}
	async removeInterview(id: string) {
		try {
			await this.candidateInterviewService.delete(id);
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
