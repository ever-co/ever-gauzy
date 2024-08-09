import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyComponent } from './currency.component';

@NgModule({
	imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule, TranslateModule.forChild()],
	declarations: [CurrencyComponent],
	exports: [CurrencyComponent]
})
export class CurrencyModule {}
