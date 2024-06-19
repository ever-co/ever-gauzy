import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
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
