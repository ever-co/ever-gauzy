import { ICandidateInterview, IOrganization } from '@gauzy/contracts';
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { CandidateInterviewMutationComponent } from '../../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@gauzy/ui-sdk/common';
import { CandidateInterviewService } from '@gauzy/ui-sdk/core';
import { ToastrService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html',
	styleUrls: ['./manage-candidate-interviews.component.scss']
})
export class ManageCandidateInterviewsComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy
{
	interviews$: Subject<any> = new Subject();
	loading: boolean;
	tabs: any[];
	interviews: ICandidateInterview[] = [];
	organization: IOrganization;
	currentTab: string;
	TAB_ID = 'ga-ak-97';

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		public readonly candidateInterviewService: CandidateInterviewService,
		private readonly store: Store,
		private readonly route: ActivatedRoute
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadTabs();
		this._applyTranslationOnTabs();
		this._currentTabName();
	}

	ngAfterViewInit() {
		this.interviews$
			.pipe(
				tap(() => this._getInterviews()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.interviews$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getRoute(tab: string): string {
		return `/pages/employees/candidates/interviews/${tab}`;
	}

	private _loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.CALENDAR'),
				responsive: true,
				route: this.getRoute('calendar')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.INTERVIEWS'),
				responsive: true,
				tabId: this.TAB_ID,
				route: this.getRoute('interview_panel')
			},
			{
				title: this.getTranslation('CANDIDATES_PAGE.MANAGE_INTERVIEWS.CRITERIONS'),
				responsive: true,
				route: this.getRoute('criterion')
			}
		];
	}

	_currentTabName() {
		const arr = this.route.children[0].snapshot.url;
		const last = arr.at(-1);
		this.currentTab = last.path === 'interview_panel' ? this.TAB_ID : null;
	}

	async addInterview() {
		const dialog = this.dialogService.open(CandidateInterviewMutationComponent, {
			context: {
				headerTitle: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'),
				isCalendar: true,
				interviews: this.interviews
			}
		});
		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.toastrService.success(`TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED`, {
				name: data.title
			});
		}
		this.interviews$.next(true);
	}

	private async _getInterviews() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.interviews = (
			await this.candidateInterviewService.getAll(
				['feedbacks', 'interviewers', 'technologies', 'personalQualities', 'candidate'],
				{
					organizationId,
					tenantId
				}
			)
		).items;
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public onChangeTab(event: any) {
		if (event) this.currentTab = event.tabId;
	}
	ngOnDestroy() {}
}
