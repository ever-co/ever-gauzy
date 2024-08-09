import { NgModule } from '@angular/core';
import {
	NbAccordionModule,
	NbActionsModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbMenuModule,
	NbRadioModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NgChartsModule } from 'ng2-charts';
import { FullCalendarModule } from '@fullcalendar/angular';
import {
	CandidateInterviewersService,
	CandidatePersonalQualitiesService,
	CandidateTechnologiesService,
	CandidatesService,
	InviteGuard,
	OrganizationEmploymentTypesService,
	OrganizationsService
} from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CandidateInterviewFeedbackModule,
	CandidateInterviewInfoModule,
	CandidateInterviewMutationModule,
	CandidateInterviewerSelectModule,
	CandidateMultiSelectModule,
	CandidateMutationModule,
	CandidateSelectModule,
	DeleteFeedbackModule,
	DeleteInterviewModule,
	EmployeeLocationModule,
	EmployeeMultiSelectModule,
	EmployeeRatesModule,
	FileUploaderModule,
	ImageUploaderModule,
	InviteMutationModule,
	InviteTableModule,
	SharedModule,
	StarRatingInputModule,
	StarRatingOutputModule,
	TableComponentsModule,
	TagsColorInputModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { EditCandidateTasksComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-tasks/edit-candidate-tasks.component';
import { EditCandidateProfileComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-profile.component';
import { EditCandidateMainComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-main/edit-candidate-main.component';
import { EditCandidateLocationComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-location/edit-candidate-location.component';
import { EditCandidateHistoryComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-history/edit-candidate-history.component';
import { EditCandidateExperienceComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-experience.component';
import { EditCandidateComponent } from './edit-candidate/edit-candidate.component';
import { CandidatesComponent } from './candidates.component';
import { CandidatesRoutingModule } from './candidates-routing.module';
import { CandidateStatusComponent } from './table-components/candidate-status/candidate-status.component';
import { ManageCandidateInviteComponent } from './manage-candidate-invite/manage-candidate-invite.component';
import { EditCandidateDocumentsComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-documents/edit-candidate-documents.component';
import { EditCandidateEmploymentComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-employment/edit-candidate-employment.component';
import { EditCandidateHiringComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-hiring/edit-candidate-hiring.component';
import { EditCandidateRatesComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-rates/edit-candidate-rates.component';
import { EditCandidateSkillsComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-skills/edit-candidate-skills.component';
import { EditCandidateEducationComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-education/edit-candidate-education.component';
import { EditCandidateExperienceFormComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-experience/edit-candidate-experience-form.component';
import { EditCandidateFeedbacksComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-feedbacks/edit-candidate-feedbacks.component';
import { CandidateSourceComponent } from './table-components/candidate-source/candidate-source.component';
import { EditCandidateInterviewComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-interview/edit-candidate-interview.component';
import { ManageCandidateInterviewsComponent } from './manage-candidate-interviews/manage-candidate-interviews.component';
import { CandidateStatisticComponent } from './candidate-statistic/candidate-statistic.component';
import { InterviewCalendarComponent } from './manage-candidate-interviews/interview-calendar/interview-calendar.component';
import { InterviewPanelComponent } from './manage-candidate-interviews/interview-panel/interview-panel.component';
import { InterviewCriterionsComponent } from './manage-candidate-interviews/interview-criterions/interview-criterions.component';
import { CandidateTechnologiesComponent } from './manage-candidate-interviews/interview-criterions/candidate-technologies/candidate-technologies.component';
import { CandidatePersonalQualitiesComponent } from './manage-candidate-interviews/interview-criterions/candidate-personal-qualities/candidate-personal-qualities.component';
import { CriterionsRatingChartComponent } from './candidate-statistic/candidate-statistic-charts/criterions-rating-chart/criterions-rating-chart.component';
import { CandidateRatingChartComponent } from './candidate-statistic/candidate-statistic-charts/overall-rating-chart/overall-rating-chart.component';
import { InterviewRatingChartComponent } from './candidate-statistic/candidate-statistic-charts/interview-rating-chart/interview-rating-chart.component';
import { AverageCriterionsRatingChartComponent } from './candidate-statistic/candidate-statistic-charts/average-criterions-rating-chart/average-criterions-rating-chart.component';
import { InterviewStarRatingComponent } from './manage-candidate-interviews/interview-panel/table-components/rating/rating.component';
import { InterviewCriterionsTableComponent } from './manage-candidate-interviews/interview-panel/table-components/criterions/criterions.component';
import { InterviewDateTableComponent } from './manage-candidate-interviews/interview-panel/table-components/date/date.component';
import { InterviewersTableComponent } from './manage-candidate-interviews/interview-panel/table-components/interviewers/interviewers.component';
import { InterviewActionsTableComponent } from './manage-candidate-interviews/interview-panel/table-components/actions/actions.component';
import { FeedbackStatusTableComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-feedbacks/table-components/status/status.component';

const COMPONENTS = [
	CandidatesComponent,
	CandidateStatusComponent,
	CandidateSourceComponent,
	EditCandidateComponent,
	EditCandidateDocumentsComponent,
	EditCandidateFeedbacksComponent,
	EditCandidateEmploymentComponent,
	EditCandidateExperienceComponent,
	EditCandidateHiringComponent,
	EditCandidateHistoryComponent,
	EditCandidateLocationComponent,
	EditCandidateMainComponent,
	EditCandidateProfileComponent,
	EditCandidateRatesComponent,
	EditCandidateTasksComponent,
	EditCandidateInterviewComponent,
	ManageCandidateInviteComponent,
	CandidateStatisticComponent,
	EditCandidateSkillsComponent,
	EditCandidateEducationComponent,
	EditCandidateExperienceFormComponent,
	ManageCandidateInterviewsComponent,
	InterviewCalendarComponent,
	InterviewPanelComponent,
	CandidateRatingChartComponent,
	CriterionsRatingChartComponent,
	InterviewRatingChartComponent,
	AverageCriterionsRatingChartComponent,
	InterviewCriterionsComponent,
	CandidateTechnologiesComponent,
	CandidatePersonalQualitiesComponent,
	InterviewStarRatingComponent,
	InterviewCriterionsTableComponent,
	InterviewDateTableComponent,
	InterviewersTableComponent,
	InterviewActionsTableComponent,
	FeedbackStatusTableComponent
];

@NgModule({
	imports: [
		FullCalendarModule,
		NbAccordionModule,
		NbActionsModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbContextMenuModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbMenuModule,
		NbRadioModule,
		NbRouteTabsetModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTabsetModule,
		NbToggleModule,
		NbTooltipModule,
		NgChartsModule,
		NgSelectModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		TableComponentsModule,
		SharedModule,
		CandidatesRoutingModule,
		ImageUploaderModule,
		FileUploaderModule,
		CandidateSelectModule,
		CandidateInterviewerSelectModule,
		TagsColorInputModule,
		CandidateMutationModule,
		CandidateInterviewMutationModule,
		CandidateInterviewInfoModule,
		InviteMutationModule,
		InviteTableModule,
		EmployeeLocationModule,
		EmployeeRatesModule,
		StarRatingInputModule,
		StarRatingOutputModule,
		CandidateMultiSelectModule,
		EmployeeMultiSelectModule,
		CandidateInterviewFeedbackModule,
		DeleteInterviewModule,
		DeleteFeedbackModule,
		SmartDataViewLayoutModule,
		WorkInProgressModule
	],
	declarations: [...COMPONENTS],
	providers: [
		OrganizationsService,
		InviteGuard,
		OrganizationEmploymentTypesService,
		CandidatesService,
		CandidateInterviewersService,
		CandidatePersonalQualitiesService,
		CandidateTechnologiesService
	]
})
export class CandidatesModule {}
