import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbDatepickerModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { FileUploaderModule, SelectorsModule } from '@gauzy/ui-sdk/shared';
import { TimeOffSettingsMutationComponent } from './settings-mutation/time-off-settings-mutation.component';
import { TimeOffRequestMutationComponent } from './time-off-request-mutation/time-off-request-mutation.component';
import { TimeOffHolidayMutationComponent } from './time-off-holiday-mutation/time-off-holiday-mutation.component';
import { TimeOffPolicySelectModule } from './time-off-policy-select/time-off-policy-select.module';

@NgModule({
	imports: [
		FormsModule,
		CommonModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		NbSelectModule,
		NbDatepickerModule,
		NbInputModule,
		NbCheckboxModule,
		NbTooltipModule,
		FileUploaderModule,
		I18nTranslateModule.forChild(),
		SelectorsModule,
		TimeOffPolicySelectModule
	],
	declarations: [TimeOffSettingsMutationComponent, TimeOffRequestMutationComponent, TimeOffHolidayMutationComponent],
	providers: []
})
export class TimeOffMutationModule {}
