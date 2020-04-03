import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Candidate } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';

@Component({
	selector: 'ngx-edit-candidate-profile',
	templateUrl: './edit-candidate-profile.component.html',
	styleUrls: [
		'../../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	],
	providers: [CandidateStore]
})
export class EditCandidateProfileComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	routeParams: Params;
	selectedCandidate: Candidate;
	candidateName = 'Candidate';
	tabs: any[];

	constructor(
		private route: ActivatedRoute,
		private location: Location,
		private candidateService: CandidatesService,
		private candidateStore: CandidateStore,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				this.routeParams = params;
				this._loadCandidateData();
			});

		this.loadTabs();
		this._applyTranslationOnTabs();
	}

	getRoute(tab: string): string {
		return `/pages/employees/candidates/edit/${this.routeParams.id}/profile/${tab}`;
	}

	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIATE.ACCOUNT'
				),
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('account')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIATE.EMPLOYMENT'
				),
				icon: 'browser-outline',
				responsive: true,
				route: this.getRoute('employment')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIATE.HIRING'
				),
				icon: 'map-outline',
				responsive: true,
				route: this.getRoute('hiring')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIATE.LOCATION'
				),
				icon: 'pin-outline',
				responsive: true,
				route: this.getRoute('location')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIATE.RATE'
				),
				icon: 'pricetags-outline',
				responsive: true,
				route: this.getRoute('rate')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIATE.TASKS'
				),
				icon: 'pricetags-outline',
				responsive: true,
				route: this.getRoute('tasks')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIATE.EXPERIENCE'
				),
				icon: 'book-outline',
				responsive: true,
				route: this.getRoute('projects')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIATE.HISTORY'
				),
				icon: 'book-outline',
				responsive: true,
				route: this.getRoute('history')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIATE.DOCUMENTS'
				),
				icon: 'book-open-outline',
				responsive: true,
				route: this.getRoute('documents')
			}
		];
	}

	goBack() {
		this.location.back();
	}

	private async _loadCandidateData() {
		const { id } = this.routeParams;
		const { items } = await this.candidateService
			.getAll(
				[
					'user',
					'organizationDepartments',
					'organizationPosition',
					'organizationEmploymentTypes',
					'tags'
				],
				{ id }
			)
			.pipe(first())
			.toPromise();

		this.selectedCandidate = items[0];
		const checkUsername = this.selectedCandidate.user.username;
		this.candidateName = checkUsername ? checkUsername : 'Candidate';

		this.candidateStore.selectedCandidate = this.selectedCandidate;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadTabs();
			});
	}
}
