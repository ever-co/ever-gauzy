import { CandidateInterviewFormComponent } from './candidate-interview-form/candidate-interview-form.component';
import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
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
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { CandidateInterviewMutationComponent } from './candidate-interview-mutation.component';
import { TimerPickerModule } from '../../timer-picker/timer-picker.module';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { CandidateSelectModule } from '../candidate-select/candidate-select.module';
import { CandidateCalendarInfoModule } from '../candidate-calendar-info/candidate-calendar-info.module';
import { CandidateCriterionsFormComponent } from './candidate-criterions-form/candidate-criterions-form.component';
import { CandidateNotificationFormComponent } from './candidate-notification-form/candidate-notification-form.component';
import { CandidateEmailComponent } from './candidate-notification-form/candidate-email/candidate-email.component';
import { CandidateTechnologiesService } from '../../../@core/services/candidate-technologies.service';

@NgModule({
	imports: [
		ReactiveFormsModule,
		NbDatepickerModule,
		NbSelectModule,
		NgSelectModule,
		NbBadgeModule,
		ThemeModule,
		FormsModule,
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
		CandidateEmailComponent
	],
	providers: [CandidateTechnologiesService]
})
export class CandidateInterviewMutationModule {}
