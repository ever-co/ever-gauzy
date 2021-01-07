import { ICandidateInterview, IOrganization } from '@gauzy/models';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { first, filter } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { CandidateInterviewMutationComponent } from '../../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import { Store } from '../../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../../@core/services/toastr.service';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html',
	styleUrls: ['./manage-candidate-interviews.component.scss']
})
export class ManageCandidateInterviewsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	tabs: any[];
	interviewList: ICandidateInterview[];
	organization: IOrganization;
	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		public candidateInterviewService: CandidateInterviewService,
		private store: Store
	) {
		super(translateService);
	}
	ngOnInit() {
		this.loadTabs();
		this._applyTranslationOnTabs();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.loadInterviews();
				}
			});
	}
	getRoute(tab: string): string {
		return `/pages/employees/candidates/interviews/${tab}`;
	}
	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.CALENDAR'
				),
				responsive: true,
				route: this.getRoute('calendar')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.INTERVIEWS'
				),
				responsive: true,
				route: this.getRoute('interview_panel')
			},
			{
				title: this.getTranslation(
					'CANDIDATES_PAGE.MANAGE_INTERVIEWS.CRITERIONS'
				),
				responsive: true,
				route: this.getRoute('criterion')
			}
		];
	}
	async add() {
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					header: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'
					),
					isCalendar: true,
					interviewList: this.interviewList
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrService.success(
				`TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED`,
				{
					name: data.title
				}
			);
			this.loadInterviews();
		}
	}
	async loadInterviews() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const res = await this.candidateInterviewService.getAll(
			[
				'feedbacks',
				'interviewers',
				'technologies',
				'personalQualities',
				'candidate'
			],
			{ organizationId, tenantId }
		);
		if (res) {
			this.interviewList = res.items;
		}
	}
	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadTabs();
			});
	}
	ngOnDestroy() {}
}
