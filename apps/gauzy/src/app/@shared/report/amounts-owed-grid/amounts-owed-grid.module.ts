import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmountsOwedGridComponent } from './amounts-owed-grid.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { FiltersModule } from '../../timesheet/filters/filters.module';
import { NoDataMessageModule } from '../../no-data-message/no-data-message.module';

@NgModule({
	declarations: [AmountsOwedGridComponent],
	exports: [AmountsOwedGridComponent],
	imports: [
		CommonModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule,
		NbSelectModule,
		FormsModule,
		NoDataMessageModule
	]
})
export class AmountsOwedGridModule {}
