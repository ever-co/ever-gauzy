import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { NoDataMessageModule } from '../../smart-data-layout/no-data-message/no-data-message.module';
import { AmountsOwedGridComponent } from './amounts-owed-grid.component';

@NgModule({
	declarations: [AmountsOwedGridComponent],
	exports: [AmountsOwedGridComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslatePipe,
		SharedModule,
		NoDataMessageModule
	]
})
export class AmountsOwedGridModule {}
