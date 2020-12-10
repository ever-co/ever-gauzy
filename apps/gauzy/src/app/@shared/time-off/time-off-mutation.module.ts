import { NgModule } from '@angular/core';
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
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';

import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { TimeOffSettingsMutationComponent } from './settings-mutation/time-off-settings-mutation.component';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { TimeOffRequestMutationComponent } from './time-off-request-mutation/time-off-request-mutation.component';
import { FileUploaderModule } from '../file-uploader-input/file-uploader-input.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		NbSelectModule,
		NbDatepickerModule,
		NbInputModule,
		NbCheckboxModule,
		NbTooltipModule,
		EmployeeSelectorsModule,
		FileUploaderModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [
		TimeOffSettingsMutationComponent,
		TimeOffRequestMutationComponent
	],
	entryComponents: [
		TimeOffSettingsMutationComponent,
		TimeOffRequestMutationComponent
	],
	providers: []
})
export class TimeOffMutationModule {}
