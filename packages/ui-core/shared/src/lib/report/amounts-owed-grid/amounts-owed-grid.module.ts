import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SmartDataViewLayoutModule } from '../../smart-data-layout/smart-data-view-layout.module';
import { AmountsOwedGridComponent } from './amounts-owed-grid.component';
import { SharedModule } from '../../shared.module';

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
		SmartDataViewLayoutModule
	]
})
export class AmountsOwedGridModule {}
