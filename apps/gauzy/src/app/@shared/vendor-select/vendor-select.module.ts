import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { VendorSelectorComponent } from './vendor/vendor.component';

@NgModule({
	declarations: [
		VendorSelectorComponent
	],
	exports: [
		VendorSelectorComponent
	],
	imports: [
		CommonModule,
		NbSelectModule,
		FormsModule,
		TranslateModule,
		NgSelectModule
	]
})
export class VendorSelectModule {}
