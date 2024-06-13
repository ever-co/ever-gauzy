import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ProductCategorySelectorComponent } from './product-category-selector.component';

@NgModule({
	declarations: [ProductCategorySelectorComponent],
	exports: [ProductCategorySelectorComponent],
	imports: [CommonModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class ProductCategorySelectorModule {}
