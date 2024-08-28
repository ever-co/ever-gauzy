import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbStepperModule,
	NbInputModule,
	NbDatepickerModule,
	NbSelectModule,
	NbBadgeModule,
	NbCheckboxModule,
	NbRadioModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { CKEditorModule } from 'ckeditor4-angular';
import { TranslateModule } from '@ngx-translate/core';
import { CandidateTechnologiesService } from '@gauzy/ui-core/core';
import { TimerPickerModule } from '../../timer-picker/timer-picker.module';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { CandidateInterviewMutationComponent } from './candidate-interview-mutation.component';
import { CandidateSelectModule } from '../selectors/candidate-select/candidate-select.module';
import { CandidateCalendarInfoModule } from '../candidate-calendar-info/candidate-calendar-info.module';
import { CandidateCriterionsFormComponent } from './candidate-criterions-form/candidate-criterions-form.component';
import { CandidateNotificationFormComponent } from './candidate-notification-form/candidate-notification-form.component';
import { CandidateEmailComponent } from './candidate-notification-form/candidate-email/candidate-email.component';
import { CandidateInterviewFormComponent } from './candidate-interview-form/candidate-interview-form.component';
import { CandidateTechnologiesComponent } from './interview-criterions/candidate-technologies/candidate-technologies.component';
import { CandidatePersonalQualitiesComponent } from './interview-criterions/candidate-personal-qualities/candidate-personal-qualities.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbDatepickerModule,
		NbSelectModule,
		NgSelectModule,
		NbBadgeModule,
		NbCheckboxModule,
		NbCardModule,
		NbInputModule,
		CKEditorModule,
		NbButtonModule,
		NbRadioModule,
		NbIconModule,
		NbStepperModule,
		NbTooltipModule,
		TimerPickerModule,
		EmployeeMultiSelectModule,
		CandidateSelectModule,
		CandidateCalendarInfoModule,
		TranslateModule.forChild()
	],
	exports: [
		CandidateInterviewMutationComponent,
		CandidateInterviewFormComponent,
		CandidateCriterionsFormComponent,
		CandidateNotificationFormComponent,
		CandidateEmailComponent
	],
	declarations: [
		CandidateInterviewMutationComponent,
		CandidateInterviewFormComponent,
		CandidateCriterionsFormComponent,
		CandidateNotificationFormComponent,
		CandidateEmailComponent,
		CandidateTechnologiesComponent,
		CandidatePersonalQualitiesComponent
	],
	providers: [CandidateTechnologiesService]
})
export class CandidateInterviewMutationModule {}
