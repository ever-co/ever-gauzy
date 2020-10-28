import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatchingRoutingModule } from './matching-routing.module';
import { MatchingComponent } from './matching/matching.component';
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
	NbRadioModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { MomentModule } from 'ngx-moment';
import { SharedModule } from '../../../@shared/shared.module';
import { EmployeeMultiSelectModule } from '../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { DialogsModule } from '../../../@shared/dialogs';

@NgModule({
	declarations: [MatchingComponent],
	imports: [
		CommonModule,
		MatchingRoutingModule,
		TranslateModule,
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
		NbRadioModule
	]
})
export class MatchingModule {}
