import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { MomentModule } from 'ngx-moment';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	DialogsModule,
	EmployeeMultiSelectModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule
} from '@gauzy/ui-sdk/shared';
import { StatusBadgeModule } from '../../../@shared/status-badge/status-badge.module';
import { SearchRoutingModule } from './search-routing.module';
import { SearchComponent } from './search/search.component';

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
		I18nTranslateModule.forChild(),
		SharedModule,
		DialogsModule,
		EmployeeMultiSelectModule,
		StatusBadgeModule,
		GauzyButtonActionModule,
		PaginationV2Module
	]
})
export class SearchModule {}
