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
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	DialogsModule,
	EmployeeMultiSelectModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule,
	StatusBadgeModule
} from '@gauzy/ui-core/shared';
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
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		SharedModule,
		DialogsModule,
		EmployeeMultiSelectModule,
		StatusBadgeModule,
		GauzyButtonActionModule,
		PaginationV2Module
	]
})
export class SearchModule {}
