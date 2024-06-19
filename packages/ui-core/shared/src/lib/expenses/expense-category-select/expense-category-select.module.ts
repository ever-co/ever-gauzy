import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { ExpenseCategorySelectComponent } from './expense-category-select.component';

@NgModule({
	declarations: [ExpenseCategorySelectComponent],
	exports: [ExpenseCategorySelectComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule]
})
export class ExpenseCategorySelectModule {}
