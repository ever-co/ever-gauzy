import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
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
		TranslateModule.forChild()
	]
})
export class PasswordFormFieldModule {}
