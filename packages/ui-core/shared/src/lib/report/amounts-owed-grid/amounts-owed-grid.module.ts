import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
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
		TranslateModule.forChild(),
		SharedModule,
		NoDataMessageModule,
		NbButtonModule
	]
})
export class AmountsOwedGridModule {}
