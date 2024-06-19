import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbInputModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { PhoneFormInputComponent } from './phone.component';

@NgModule({
	declarations: [PhoneFormInputComponent],
	exports: [PhoneFormInputComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, I18nTranslateModule.forChild(), NbInputModule]
})
export class PhoneFormInputModule {}
