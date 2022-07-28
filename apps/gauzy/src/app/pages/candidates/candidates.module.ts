import { CandidatePersonalQualitiesService } from './../../@core/services/candidate-personal-qualities.service';
import { EditCandidateTasksComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-tasks/edit-candidate-tasks.component';
import { EditCandidateProfileComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-profile.component';
import { EditCandidateMainComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-main/edit-candidate-main.component';
import { EditCandidateLocationComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-location/edit-candidate-location.component';
import { EditCandidateHistoryComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-history/edit-candidate-history.component';
import { EditCandidateExperienceComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-experience.component';
import { EditCandidateComponent } from './edit-candidate/edit-candidate.component';
import { CandidatesService } from './../../@core/services/candidates.service';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbSelectModule,
	NbDatepickerModule,
	NbActionsModule,
	NbTabsetModule,
	NbRadioModule,
	NbMenuModule,
	NbContextMenuModule,
	NbAccordionModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { OrganizationEmploymentTypesService } from '../../@core/services/organization-employment-types.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { ThemeModule } from '../../@theme/theme.module';
import { InviteGuard } from './../../@core/guards';
import { SharedModule } from '../../@shared/shared.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
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
import { EmployeeLocationModule } from '../../@shared/employee/employee-location/employee-location.module';
import { EmployeeRatesModule } from '../../@shared/employee/employee-rates/employee-rates.module';
import { EditCandidateSkillsComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-skills/edit-candidate-skills.component';
import { EditCandidateEducationComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-education/edit-candidate-education.component';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { FileUploaderModule } from '../../@shared/file-uploader-input/file-uploader-input.module';
import { EditCandidateExperienceFormComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-experience/edit-candidate-experience-form.component';
import { EditCandidateFeedbacksComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-feedbacks/edit-candidate-feedbacks.component';
import { StarRatingInputModule } from '../../@shared/star-rating/star-rating-input/star-rating-input.module';
import { StarRatingOutputModule } from '../../@shared/star-rating/star-rating-output/star-rating-output.module';
import { CandidateSourceComponent } from './table-components/candidate-source/candidate-source.component';
import { EditCandidateInterviewComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-interview/edit-candidate-interview.component';
import { CandidateInterviewMutationModule } from '../../@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.module';
import { ManageCandidateInterviewsComponent } from './manage-candidate-interviews/manage-candidate-interviews.component';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CandidateInterviewInfoModule } from '../../@shared/candidate/candidate-interview-info/candidate-interview-info.module';
import { CandidateInterviewersService } from '../../@core/services/candidate-interviewers.service';
import { CandidateMultiSelectModule } from '../../@shared/candidate/candidate-multi-select/candidate-multi-select.module';
import { EmployeeMultiSelectModule } from '../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { CandidateInterviewFeedbackModule } from '../../@shared/candidate/candidate-interview-feedback/candidate-interview-feedback.module';
import { CandidateStatisticComponent } from './candidate-statistic/candidate-statistic.component';
import { ChartModule } from 'angular2-chartjs';
import { CandidateTechnologiesService } from '../../@core/services/candidate-technologies.service';
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
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { NbToggleModule } from '@nebular/theme';
import { PaginationModule } from '../../@shared/pagination/pagination.module';
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
		FullCalendarModule,
		TableComponentsModule,
		SharedModule,
		ChartModule,
		CandidatesRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		NbTooltipModule,
		NgSelectModule,
		ImageUploaderModule,
		NbBadgeModule,
		NbRouteTabsetModule,
		NbCheckboxModule,
		FileUploaderModule,
		NbTabsetModule,
		CandidateSelectModule,
		NbRadioModule,
		NbActionsModule,
		NbAccordionModule,
		TranslateModule,
		NbSpinnerModule,
		NbDatepickerModule,
		TagsColorInputModule,
		CandidateMutationModule,
		CandidateInterviewMutationModule,
		CandidateInterviewInfoModule,
		InviteMutationModule,
		InviteTableModule,
		EmployeeLocationModule,
		EmployeeRatesModule,
		NbMenuModule,
		NbContextMenuModule,
		NbActionsModule,
		StarRatingInputModule,
		CardGridModule,
		StarRatingOutputModule,
		CandidateMultiSelectModule,
		EmployeeMultiSelectModule,
		CandidateInterviewFeedbackModule,
		DeleteInterviewModule,
		DeleteFeedbackModule,
		NgxPermissionsModule.forChild(),
		HeaderTitleModule,
    	GauzyButtonActionModule,
    	NbToggleModule,
    	PaginationModule,
    	CardGridModule,
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
