import { ICandidateInterview, IOrganization } from '@gauzy/contracts';
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { first, filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { CandidateInterviewMutationComponent } from '../../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { CandidateInterviewService, Store, ToastrService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html',
	styleUrls: ['./manage-candidate-interviews.component.scss']
})
export class ManageCandidateInterviewsComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	interviews$: Subject<any> = new Subject();
	loading: boolean;
	tabs: any[];
	interviews: ICandidateInterview[] = [];
	organization: IOrganization;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		public readonly candidateInterviewService: CandidateInterviewService,
		private readonly store: Store
	) {
		super(translateService);
	}
	
	ngOnInit() {
		this._loadTabs();
		this._applyTranslationOnTabs();
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
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.interviews$.next()),
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

	async addInterview() {
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					headerTitle: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.SCHEDULE_INTERVIEW'),
					isCalendar: true,
					interviews: this.interviews
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrService.success( `TOASTR.MESSAGE.CANDIDATE_EDIT_CREATED`, {
				name: data.title
			});
		}
		this.interviews$.next();
	}
	
	private async _getInterviews() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.interviews = (
			await this.candidateInterviewService.getAll([
				'feedbacks',
				'interviewers',
				'technologies',
				'personalQualities',
				'candidate'
			], {
				organizationId,
				tenantId
			})
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

	ngOnDestroy() {}
}
