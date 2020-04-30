import { Component, OnInit, OnDestroy } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { UsersService } from 'apps/gauzy/src/app/@core/services';

@Component({
	selector: 'ga-edit-candidate-history',
	templateUrl: './edit-candidate-history.component.html',
	styleUrls: ['./edit-candidate-history.component.scss']
})
export class EditCandidateHistoryComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	candidateName: string;
	userName: string;
	actionList = [1, 2, 3, 4, 5];
	constructor(
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private usersService: UsersService
	) {
		super(translateService);
	}
	async ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.candidateName = `${candidate.user.firstName} ${candidate.user.lastName}`;
					// const create=candidate.createdAt;
				}
			});
		const res = await this.usersService.getMe();
		if (res) {
			this.userName = res.email;
		}
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
