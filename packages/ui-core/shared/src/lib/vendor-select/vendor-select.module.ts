import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { VendorSelectComponent } from './vendor-select.component';

@NgModule({
	declarations: [VendorSelectComponent],
	exports: [VendorSelectComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, TranslateModule.forChild(), NgSelectModule]
})
export class VendorSelectModule {}
