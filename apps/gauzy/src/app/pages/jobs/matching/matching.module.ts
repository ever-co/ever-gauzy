import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbPopoverModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbButtonModule,
	NbCheckboxModule,
	NbRadioModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { MomentModule } from 'ngx-moment';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { DialogsModule, EmployeeMultiSelectModule, SharedModule } from '@gauzy/ui-core/shared';
import { MatchingRoutingModule } from './matching-routing.module';
import { MatchingComponent } from './matching/matching.component';

@NgModule({
	declarations: [MatchingComponent],
	imports: [
		CommonModule,
		MatchingRoutingModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		NbIconModule,
		NbSpinnerModule,
		MomentModule,
		NbPopoverModule,
		NbCardModule,
		NbInputModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		NbButtonModule,
		EmployeeMultiSelectModule,
		NgSelectModule,
		NbCheckboxModule,
		DialogsModule,
		NbRadioModule,
		NbTooltipModule
	]
})
export class MatchingModule {}
