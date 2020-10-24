import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SearchRoutingModule } from './search-routing.module';
import { SearchComponent } from './search/search.component';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../../@shared/shared.module';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbPopoverModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { FormsModule } from '@angular/forms';
import { EmployeeMultiSelectModule } from '../../../@shared/employee/employee-multi-select/employee-multi-select.module';

@NgModule({
	declarations: [SearchComponent],
	imports: [
		CommonModule,
		SearchRoutingModule,
		TranslateModule,
		SharedModule,
		NbIconModule,
		NbSpinnerModule,
		MomentModule,
		NbPopoverModule,
		NbCardModule,
		NbInputModule,
		FormsModule,
		NbSelectModule,
		NbButtonModule,
		EmployeeMultiSelectModule
	]
})
export class SearchModule {}
