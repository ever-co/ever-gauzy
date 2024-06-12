import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { Angular2SmartTableModule } from 'angular2-smart-table';
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
} from '@gauzy/ui-sdk/core';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	EmployeeLocationModule,
	EmployeeMultiSelectModule,
	EmployeeRatesModule,
	FileUploaderModule,
	GauzyButtonActionModule,
	ImageUploaderModule,
	PaginationV2Module,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-sdk/shared';
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
import { CandidateMutationModule } from '../../@shared/candidate/candidate-mutation/candidate-mutation.module';
import { InviteMutationModule } from '../../@shared/invite/invite-mutation/invite-mutation.module';
import { ManageCandidateInviteComponent } from './manage-candidate-invite/manage-candidate-invite.component';
import { InviteTableModule } from '../../@shared/invite/invites/invites.module';
import { EditCandidateDocumentsComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-documents/edit-candidate-documents.component';
import { EditCandidateEmploymentComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-employment/edit-candidate-employment.component';
import { EditCandidateHiringComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-hiring/edit-candidate-hiring.component';
import { EditCandidateRatesComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-rates/edit-candidate-rates.component';
import { EditCandidateSkillsComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-skills/edit-candidate-skills.component';
import { EditCandidateEducationComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-education/edit-candidate-education.component';
import { EditCandidateExperienceFormComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-experience/edit-candidate-experience-form.component';
import { EditCandidateFeedbacksComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-feedbacks/edit-candidate-feedbacks.component';
import { StarRatingInputModule } from '../../@shared/star-rating/star-rating-input/star-rating-input.module';
import { StarRatingOutputModule } from '../../@shared/star-rating/star-rating-output/star-rating-output.module';
import { CandidateSourceComponent } from './table-components/candidate-source/candidate-source.component';
import { EditCandidateInterviewComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-interview/edit-candidate-interview.component';
import { CandidateInterviewMutationModule } from '../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.module';
import { ManageCandidateInterviewsComponent } from './manage-candidate-interviews/manage-candidate-interviews.component';
import { CandidateInterviewInfoModule } from '../../@shared/candidate/candidate-interview-info/candidate-interview-info.module';
import { CandidateMultiSelectModule } from '../../@shared/candidate/candidate-multi-select/candidate-multi-select.module';
import { CandidateInterviewFeedbackModule } from '../../@shared/candidate/candidate-interview-feedback/candidate-interview-feedback.module';
import { CandidateStatisticComponent } from './candidate-statistic/candidate-statistic.component';
import { InterviewCalendarComponent } from './manage-candidate-interviews/interview-calendar/interview-calendar.component';
import { InterviewPanelComponent } from './manage-candidate-interviews/interview-panel/interview-panel.component';
import { InterviewCriterionsComponent } from './manage-candidate-interviews/interview-criterions/interview-criterions.component';
import { CandidateTechnologiesComponent } from './manage-candidate-interviews/interview-criterions/candidate-technologies/candidate-technologies.component';
import { CandidatePersonalQualitiesComponent } from './manage-candidate-interviews/interview-criterions/candidate-personal-qualities/candidate-personal-qualities.component';
import { CriterionsRatingChartComponent } from './candidate-statistic/candidate-statistic-charts/criterions-rating-chart/criterions-rating-chart.component';
import { CandidateSelectModule } from '../../@shared/candidate/candidate-select/candidate-select.module';
import { DeleteInterviewModule } from '../../@shared/candidate/candidate-confirmation/delete-interview/delete-interview.module';
import { DeleteFeedbackModule } from '../../@shared/candidate/candidate-confirmation/delete-feedback/delete-feedback.module';
import { CandidateRatingChartComponent } from './candidate-statistic/candidate-statistic-charts/overall-rating-chart/overall-rating-chart.component';
import { InterviewRatingChartComponent } from './candidate-statistic/candidate-statistic-charts/interview-rating-chart/interview-rating-chart.component';
import { AverageCriterionsRatingChartComponent } from './candidate-statistic/candidate-statistic-charts/average-criterions-rating-chart/average-criterions-rating-chart.component';
import { InterviewStarRatingComponent } from './manage-candidate-interviews/interview-panel/table-components/rating/rating.component';
import { InterviewCriterionsTableComponent } from './manage-candidate-interviews/interview-panel/table-components/criterions/criterions.component';
import { InterviewDateTableComponent } from './manage-candidate-interviews/interview-panel/table-components/date/date.component';
import { InterviewersTableComponent } from './manage-candidate-interviews/interview-panel/table-components/interviewers/interviewers.component';
import { InterviewActionsTableComponent } from './manage-candidate-interviews/interview-panel/table-components/actions/actions.component';
import { FeedbackStatusTableComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-feedbacks/table-components/status/status.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { WorkInProgressModule } from '../work-in-progress/work-in-progress.module';

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
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		Angular2SmartTableModule,
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
		I18nTranslateModule.forChild(),
		TableComponentsModule,
		SharedModule,
		CandidatesRoutingModule,
		ImageUploaderModule,
		FileUploaderModule,
		CandidateSelectModule,
		TagsColorInputModule,
		CandidateMutationModule,
		CandidateInterviewMutationModule,
		CandidateInterviewInfoModule,
		InviteMutationModule,
		InviteTableModule,
		EmployeeLocationModule,
		EmployeeRatesModule,
		StarRatingInputModule,
		CardGridModule,
		StarRatingOutputModule,
		CandidateMultiSelectModule,
		EmployeeMultiSelectModule,
		CandidateInterviewFeedbackModule,
		DeleteInterviewModule,
		DeleteFeedbackModule,
		GauzyButtonActionModule,
		PaginationV2Module,
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
