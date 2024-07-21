import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { NbButtonModule, NbFormFieldModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { PasswordFormFieldComponent } from './password.component';

@NgModule({
	declarations: [PasswordFormFieldComponent],
	exports: [PasswordFormFieldComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbFormFieldModule,
		NbIconModule,
		NbInputModule,
		I18nTranslateModule.forChild()
	]
})
export class PasswordFormFieldModule {}
