import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { PermissionsEnum, ICandidate, ICandidateInterview, IFavorite } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { Subject, firstValueFrom } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { getEntityDisplayName } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { takeUntil } from 'rxjs/operators';
import { CandidateInterviewService, CandidatesService } from '@gauzy/ui-core/core';
import { NbDialogService } from '@nebular/theme';
import { CandidateInterviewInfoComponent } from '@gauzy/ui-core/shared';

@Component({
	selector: 'ga-edit-candidate',
	templateUrl: './edit-candidate.component.html',
	styleUrls: ['../../dashboard/dashboard.component.scss', './edit-candidate.component.scss'],
	standalone: false
})
export class EditCandidateComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	selectedCandidate: ICandidate;
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
		this.store.userRolePermissions$.pipe(takeUntil(this._ngDestroy$)).subscribe(() => {
			this.hasEditPermission = this.store.hasPermission(PermissionsEnum.ORG_CANDIDATES_EDIT);
		});

		this.route.params.pipe(takeUntil(this._ngDestroy$)).subscribe(async (params) => {
			const id = params.id;

			const { items } = await firstValueFrom(this.candidatesService.getAll(['user'], { id }));

			this.selectedCandidate = items[0];
			this.loadInterview();
			const checkUsername = this.selectedCandidate.user.username;
			this.candidateName = checkUsername ? checkUsername : 'Candidate';
		});
	}

	private async loadInterview() {
		const interviews = await firstValueFrom(
			this.candidateInterviewService.getAll(['interviewers', 'technologies', 'personalQualities', 'feedbacks'], {
				candidateId: this.selectedCandidate.id
			})
		);

		if (interviews) {
			this.interviewList = interviews.items;
		}
	}

	async interviewInfo() {
		if (this.interviewList.length > 0) {
			this.dialogService.open(CandidateInterviewInfoComponent, {
				context: {
					interviews: this.interviewList,
					selectedCandidate: this.selectedCandidate,
					isSlider: true
				}
			});
		}
	}

	editCandidate() {
		this.router.navigate(['/pages/employees/candidates/edit/' + this.selectedCandidate.id + '/profile']);
	}

	/**
	 * Handle favorite toggle event
	 */
	onFavoriteToggled(_event: { isFavorite: boolean; favorite?: IFavorite }): void {
		// The FavoriteToggleComponent already shows success/error messages
		// Additional logic can be added here if needed (analytics, state updates, etc.)
	}

	get candidateFullName(): string {
		return getEntityDisplayName(this.selectedCandidate);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
