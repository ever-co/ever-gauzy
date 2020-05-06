import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { PermissionsEnum, Candidate } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { takeUntil, first } from 'rxjs/operators';
import { CandidatesService } from '../../../@core/services/candidates.service';

@Component({
	selector: 'ngx-edit-candidate',
	templateUrl: './edit-candidate.component.html',
	styleUrls: [
		'../../organizations/edit-organization/edit-organization.component.scss',
		'../../dashboard/dashboard.component.scss',
		'./edit-candidate.component.scss'
	]
})
export class EditCandidateComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	selectedCandidate: Candidate;
	selectedInterview = true;
	candidateName = 'Candidate';
	hasEditPermission = false;
	constructor(
		private router: Router,
		private store: Store,
		private candidatesService: CandidatesService,
		private route: ActivatedRoute,
		readonly translateService: TranslateService
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
					.getAll(['user', 'organizationPosition', 'tags'], { id })
					.pipe(first())
					.toPromise();

				this.selectedCandidate = items[0];

				const checkUsername = this.selectedCandidate.user.username;
				this.candidateName = checkUsername
					? checkUsername
					: 'Candidate';
			});
	}

	editCandidate() {
		this.router.navigate([
			'/pages/employees/candidates/edit/' +
				this.selectedCandidate.id +
				'/profile'
		]);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
