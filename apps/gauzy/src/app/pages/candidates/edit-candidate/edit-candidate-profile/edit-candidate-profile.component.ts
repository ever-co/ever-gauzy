import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	ICandidate,
	ICandidateUpdateInput,
	IUserUpdateInput,
	ICandidateInterview,
	IOrganization
} from '@gauzy/contracts';
import {
	CandidateInterviewService,
	CandidateStore,
	CandidatesService,
	ErrorHandlingService,
	ToastrService,
	UsersService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { CandidateInterviewInfoComponent } from '@gauzy/ui-core/shared';
import { firstValueFrom } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-edit-candidate-profile',
    templateUrl: './edit-candidate-profile.component.html',
    styleUrls: ['./edit-candidate-profile.component.scss'],
    providers: [CandidateStore],
    standalone: false
})
export class EditCandidateProfileComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	routeParams: Params;
	selectedCandidate: ICandidate;
	candidateName = 'Candidate';
	tabs: any[];
	interviewList: ICandidateInterview[];
	futureInterviews: ICandidateInterview[];
	selectedOrganization: IOrganization;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly location: Location,
		private readonly candidatesService: CandidatesService,
		private readonly candidateStore: CandidateStore,
		private readonly userService: UsersService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly dialogService: NbDialogService,
		private readonly candidateInterviewService: CandidateInterviewService,
		readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params.pipe(untilDestroyed(this)).subscribe((params) => {
			this.routeParams = params;
			this.store.selectedOrganization$.pipe(untilDestroyed(this)).subscribe((organization) => {
				if (organization) {
					this.selectedOrganization = this.store.selectedOrganization;
					this._loadCandidateData();
				}
			});
		});
		this.candidateStore.userForm$.pipe(untilDestroyed(this)).subscribe((value) => {
			this.submitUserForm(value);
		});
		this.candidateStore.candidateForm$.pipe(untilDestroyed(this)).subscribe((value) => {
			this.submitCandidateForm(value);
		});
		this.loadTabs();
		this._applyTranslationOnTabs();
	}

	private async loadInterviews() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const interviews = await firstValueFrom(
			this.candidateInterviewService.getAll(['interviewers', 'technologies', 'personalQualities', 'feedbacks'], {
				candidateId: this.selectedCandidate.id,
				organizationId,
				tenantId
			})
		);
		if (interviews) {
			this.interviewList = interviews.items;
			const now = new Date().getTime();
			this.futureInterviews = this.interviewList.filter((item) => new Date(item.startTime).getTime() > now);
		}
	}
	async interviewInfo() {
		if (this.futureInterviews.length > 0) {
			this.dialogService.open(CandidateInterviewInfoComponent, {
				context: {
					interviews: this.futureInterviews,
					selectedCandidate: this.selectedCandidate,
					isSlider: true
				}
			});
		}
	}

	getRoute(tab: string): string {
		return `/pages/employees/candidates/edit/${this.routeParams.id}/profile/${tab}`;
	}

	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.ACCOUNT'),
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('account')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.EMPLOYMENT'),
				icon: 'browser-outline',
				responsive: true,
				route: this.getRoute('employment')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.HIRING'),
				icon: 'map-outline',
				responsive: true,
				route: this.getRoute('hiring')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.LOCATION'),
				icon: 'pin-outline',
				responsive: true,
				route: this.getRoute('location')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.RATE'),
				icon: 'pricetags-outline',
				responsive: true,
				route: this.getRoute('rates')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.TASKS'),
				icon: 'layers-outline',
				responsive: true,
				route: this.getRoute('tasks')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.EXPERIENCE'),
				icon: 'book-open-outline',
				responsive: true,
				route: this.getRoute('experience')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.HISTORY'),
				icon: 'archive-outline',
				responsive: true,
				route: this.getRoute('history')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.DOCUMENTS'),
				icon: 'file-text-outline',
				responsive: true,
				route: this.getRoute('documents')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.INTERVIEW'),
				icon: 'people-outline',
				responsive: true,
				route: this.getRoute('interview')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.FEEDBACKS'),
				icon: 'message-square-outline',
				responsive: true,
				route: this.getRoute('feedbacks')
			}
		];
	}

	goBack() {
		this.location.back();
	}

	private async submitCandidateForm(value: ICandidateUpdateInput) {
		if (value) {
			try {
				const { organizationId, tenantId } = this.selectedCandidate;
				await this.candidatesService.update(this.selectedCandidate.id, {
					...value,
					organizationId,
					tenantId
				});
				this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_PROFILE_UPDATE', {
					name: this.candidateName
				});
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
	private async submitUserForm(value: IUserUpdateInput) {
		if (value) {
			try {
				await this.userService.update(this.selectedCandidate.user.id, value);

				this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_PROFILE_UPDATE', {
					name: this.candidateName
				});

				this._loadCandidateData();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private async _loadCandidateData() {
		const { id } = this.routeParams;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;
		const candidate = await this.candidatesService.getCandidateById(
			id,
			[
				'user',
				'tags',
				'contact',
				'organizationPosition',
				'organizationDepartments',
				'organizationEmploymentTypes'
			],
			{ organizationId, tenantId }
		);
		if (!candidate) {
			return false;
		}

		this.selectedCandidate = candidate;
		const checkUsername = this.selectedCandidate.user.username;
		this.candidateName = checkUsername ? checkUsername : 'Candidate';

		this.candidateStore.selectedCandidate = this.selectedCandidate;
		this.loadInterviews();
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.loadTabs();
		});
	}

	ngOnDestroy() {}
}
