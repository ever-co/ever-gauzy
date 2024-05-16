import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SearchRoutingModule } from './search-routing.module';
import { SearchComponent } from './search/search.component';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../../@shared/shared.module';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { EmployeeMultiSelectModule } from '../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { StatusBadgeModule } from '../../../@shared/status-badge/status-badge.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { DialogsModule } from '../../../@shared/dialogs';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../../@shared/gauzy-button-action/gauzy-button-action.module';
import { NbTabsetModule } from '@nebular/theme';
import { PaginationV2Module } from '../../../@shared/pagination/pagination-v2/pagination-v2.module';

@NgModule({
	declarations: [SearchComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		MomentModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbPopoverModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTabsetModule,
		NbToggleModule,
		Angular2SmartTableModule,
		SearchRoutingModule,
		TranslateModule,
		SharedModule,
		DialogsModule,
		EmployeeMultiSelectModule,
		StatusBadgeModule,
		HeaderTitleModule,
		GauzyButtonActionModule,
		PaginationV2Module
	]
})
export class SearchModule {}
