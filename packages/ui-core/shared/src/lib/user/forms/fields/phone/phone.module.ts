import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbInputModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { PhoneFormInputComponent } from './phone.component';

@NgModule({
	declarations: [PhoneFormInputComponent],
	exports: [PhoneFormInputComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, I18nTranslateModule.forChild(), NbInputModule]
})
export class PhoneFormInputModule {}
