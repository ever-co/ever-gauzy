import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { ContactSelectComponent } from './contact-select.component';

@NgModule({
	declarations: [ContactSelectComponent],
	exports: [ContactSelectComponent],
	imports: [CommonModule, FormsModule, NgSelectModule, I18nTranslateModule.forChild()]
})
export class ContactSelectModule {}
