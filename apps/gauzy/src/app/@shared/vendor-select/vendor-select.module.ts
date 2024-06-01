import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { VendorSelectComponent } from './vendor-select.component';

@NgModule({
	declarations: [VendorSelectComponent],
	exports: [VendorSelectComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class VendorSelectModule {}
