import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { NoDataMessageModule } from '../../no-data-message/no-data-message.module';
import { AmountsOwedGridComponent } from './amounts-owed-grid.component';

@NgModule({
	declarations: [AmountsOwedGridComponent],
	exports: [AmountsOwedGridComponent],
	imports: [
		CommonModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		NoDataMessageModule
	]
})
export class AmountsOwedGridModule {}
