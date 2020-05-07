import { ICandidateInterview } from './../../../../../../../../../libs/models/src/lib/candidate-interview.model';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { CandidateInterviewMutationComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { first, takeUntil } from 'rxjs/operators';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';

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
	candidateName: string;
	constructor(
		private candidatesService: CandidatesService,
		private dialogService: NbDialogService,
		private translate: TranslateService,
		private errorHandler: ErrorHandlingService,
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
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
