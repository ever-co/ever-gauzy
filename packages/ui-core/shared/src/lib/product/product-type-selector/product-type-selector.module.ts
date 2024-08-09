import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { ProductTypeSelectorComponent } from './product-type-selector.component';

@NgModule({
	declarations: [ProductTypeSelectorComponent],
	exports: [ProductTypeSelectorComponent],
	imports: [CommonModule, FormsModule, TranslateModule.forChild(), NgSelectModule]
})
export class ProductTypeSelectorModule {}
