import { Component, OnInit, OnDestroy } from '@angular/core';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { CandidateInterviewMutationComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { first } from 'rxjs/operators';

@Component({
	selector: 'ga-edit-candidate-interview',
	templateUrl: './edit-candidate-interview.component.html',
	styleUrls: ['./edit-candidate-interview.component.scss']
})
export class EditCandidateInterviewComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private candidatesService: CandidatesService,
		private dialogService: NbDialogService,
		private translate: TranslateService,
		private errorHandler: ErrorHandlingService
	) {
		super(translate);
	}
	ngOnInit() {}

	async add() {
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent
		);

		const response = await dialog.onClose.pipe(first()).toPromise();

		if (response) {
			// response.map((data) => {
			// 	if (data.user.firstName || data.user.lastName) {
			// 		this.candidateName =
			// 			data.user.firstName + ' ' + data.user.lastName;
			// 	}
			// 	this.toastrService.primary(
			// 		this.candidateName.trim() +
			// 			' added to ' +
			// 			data.organization.name,
			// 		'Success'
			// 	);
			// });
			//this.loadPage();
		}
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
