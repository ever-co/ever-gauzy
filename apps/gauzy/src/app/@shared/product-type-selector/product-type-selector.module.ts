import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ProductTypeSelectorComponent } from './product-type-selector.component';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	declarations: [ProductTypeSelectorComponent],
	exports: [ProductTypeSelectorComponent],
	imports: [CommonModule, FormsModule, TranslateModule, NgSelectModule]
})
export class ProductTypeSelectorModule {}
