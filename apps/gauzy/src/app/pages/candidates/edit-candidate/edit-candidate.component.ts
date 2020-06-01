import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { PermissionsEnum, Candidate, ICandidateInterview } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { takeUntil, first } from 'rxjs/operators';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { CandidateInterviewInfoComponent } from '../../../@shared/candidate/candidate-interview-info/candidate-interview-info.component';
import { NbDialogService } from '@nebular/theme';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';

@Component({
	selector: 'ga-edit-candidate',
	templateUrl: './edit-candidate.component.html',
	styleUrls: [
		'../../organizations/edit-organization/edit-organization.component.scss',
		'../../dashboard/dashboard.component.scss',
		'./edit-candidate.component.scss',
	],
})
export class EditCandidateComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	selectedCandidate: Candidate;
	candidateName = 'Candidate';
	interviewList: ICandidateInterview[];
	hasEditPermission = false;
	constructor(
		private readonly candidateInterviewService: CandidateInterviewService,
		private router: Router,
		private store: Store,
		private candidatesService: CandidatesService,
		private route: ActivatedRoute,
		readonly translateService: TranslateService,
		private dialogService: NbDialogService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_CANDIDATES_EDIT
				);
			});

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const id = params.id;

				const { items } = await this.candidatesService
					.getAll(['user'], { id })
					.pipe(first())
					.toPromise();

				this.selectedCandidate = items[0];
				this.loadInterview();
				const checkUsername = this.selectedCandidate.user.username;
				this.candidateName = checkUsername
					? checkUsername
					: 'Candidate';
			});
	}
	private async loadInterview() {
		const res = await this.candidateInterviewService.findByCandidateId(
			this.selectedCandidate.id
		);
		if (res) {
			this.interviewList = res;
		}
	}
	async interviewInfo() {
		if (this.interviewList.length > 0) {
			this.dialogService.open(CandidateInterviewInfoComponent, {
				context: {
					interviewList: this.interviewList,
					selectedCandidate: this.selectedCandidate,
				},
			});
		}
	}

	editCandidate() {
		this.router.navigate([
			'/pages/employees/candidates/edit/' +
				this.selectedCandidate.id +
				'/profile',
		]);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
