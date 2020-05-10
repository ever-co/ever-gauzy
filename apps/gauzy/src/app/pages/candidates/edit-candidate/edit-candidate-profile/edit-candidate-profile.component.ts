import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import {
	Candidate,
	CandidateUpdateInput,
	UserUpdateInput
} from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { UsersService } from 'apps/gauzy/src/app/@core/services';
import { NbToastrService } from '@nebular/theme';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';

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
		private candidatesService: CandidatesService,
		private candidateStore: CandidateStore,
		private userService: UsersService,
		private toastrService: NbToastrService,
		private errorHandler: ErrorHandlingService,
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

		this.candidateStore.userForm$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((value) => {
				this.submitUserForm(value);
			});

		this.candidateStore.candidateForm$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((value) => {
				this.submitCandidateForm(value);
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
					'CANDIDATES_PAGE.EDIT_CANDIDATE.ACCOUNT'
				),
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('account')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.EMPLOYMENT'
				),
				icon: 'browser-outline',
				responsive: true,
				route: this.getRoute('employment')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.HIRING'
				),
				icon: 'map-outline',
				responsive: true,
				route: this.getRoute('hiring')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.LOCATION'
				),
				icon: 'pin-outline',
				responsive: true,
				route: this.getRoute('location')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.RATE'
				),
				icon: 'pricetags-outline',
				responsive: true,
				route: this.getRoute('rates')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.TASKS'
				),
				icon: 'layers-outline',
				responsive: true,
				route: this.getRoute('tasks')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.EXPERIENCE'
				),
				icon: 'book-open-outline',
				responsive: true,
				route: this.getRoute('experience')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.HISTORY'
				),
				icon: 'archive-outline',
				responsive: true,
				route: this.getRoute('history')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.DOCUMENTS'
				),
				icon: 'file-text-outline',
				responsive: true,
				route: this.getRoute('documents')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.INTERVIEW'
				),
				icon: 'people-outline',
				responsive: true,
				route: this.getRoute('interview')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.EDIT_CANDIDATE.FEEDBACKS'
				),
				icon: 'message-square-outline',
				responsive: true,
				route: this.getRoute('feedbacks')
			}
		];
	}

	goBack() {
		this.location.back();
	}

	private async submitCandidateForm(value: CandidateUpdateInput) {
		if (value) {
			try {
				await this.candidatesService.update(
					this.selectedCandidate.id,
					value
				);

				this.toastrService.primary(
					this.getTranslation(
						'TOASTR.MESSAGE.CANDIDATE_PROFILE_UPDATE',
						{ name: this.candidateName }
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this._loadCandidateData();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	/**
	 * This is to update the User details of an Candidate.
	 * Do NOT use this function to update any details which are NOT stored in the User Entity.
	 */
	private async submitUserForm(value: UserUpdateInput) {
		if (value) {
			try {
				await this.userService.update(
					this.selectedCandidate.user.id,
					value
				);

				this.toastrService.primary(
					this.getTranslation(
						'TOASTR.MESSAGE.CANDIDATE_PROFILE_UPDATE',
						{ name: this.candidateName }
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);

				this._loadCandidateData();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private async _loadCandidateData() {
		const { id } = this.routeParams;
		const { items } = await this.candidatesService
			.getAll(['user'], { id })
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
