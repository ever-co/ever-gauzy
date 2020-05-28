import { EditCandidateTasksComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-tasks/edit-candidate-tasks.component';
import { EditCandidateProfileComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-profile.component';
import { EditCandidateMainComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-main/edit-candidate-main.component';
import { EditCandidateLocationComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-location/edit-candidate-location.component';
import { EditCandidateHistoryComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-history/edit-candidate-history.component';
import { EditCandidateExperienceComponent } from './edit-candidate/edit-candidate-profile/edit-candidate-experience/edit-candidate-experience.component';
import { EditCandidateComponent } from './edit-candidate/edit-candidate.component';
import { CandidatesService } from './../../@core/services/candidates.service';
import { HttpClient } from '@angular/common/http';
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
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { CountryService } from '../../@core/services/country.service';
import { OrganizationEmploymentTypesService } from '../../@core/services/organization-employment-types.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { ThemeModule } from '../../@theme/theme.module';
import { InviteGuard } from './../../@core/role/invite.guard';
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

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
	EditCandidateSkillsComponent,
	EditCandidateEducationComponent,
	EditCandidateExperienceFormComponent,
	ManageCandidateInterviewsComponent,
];

@NgModule({
	imports: [
		FullCalendarModule,
		TableComponentsModule,
		SharedModule,
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
		NbRadioModule,
		NbActionsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient],
			},
		}),
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
		StarRatingInputModule,
		StarRatingOutputModule,
		CandidateMultiSelectModule,
		EmployeeMultiSelectModule,
		CandidateInterviewFeedbackModule,
	],
	declarations: [...COMPONENTS],
	entryComponents: [
		CandidateStatusComponent,
		CandidateSourceComponent,
		ManageCandidateInviteComponent,
	],
	providers: [
		OrganizationsService,
		InviteGuard,
		CountryService,
		OrganizationEmploymentTypesService,
		CandidatesService,
		CandidateInterviewersService,
	],
})
export class CandidatesModule {}
