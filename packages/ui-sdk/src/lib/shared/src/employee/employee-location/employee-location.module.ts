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
import { LeafletMapModule, LocationFormModule } from '../../forms';
import { EmployeeLocationComponent } from './employee-location.component';

@NgModule({
	imports: [
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
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
