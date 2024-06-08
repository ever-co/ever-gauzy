import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbSelectModule,
	NbInputModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { CandidateStore, EmployeeStore } from '@gauzy/ui-sdk/core';
import { LocationFormModule, LeafletMapModule } from '@gauzy/ui-sdk/shared';
import { ThemeModule } from '../../../@theme/theme.module';
import { EmployeeLocationComponent } from './employee-location.component';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		ThemeModule,
		NbActionsModule,
		I18nTranslateModule.forChild(),
		LocationFormModule,
		LeafletMapModule
	],
	exports: [EmployeeLocationComponent],
	declarations: [EmployeeLocationComponent],
	providers: [CandidateStore, EmployeeStore]
})
export class EmployeeLocationModule {}
