import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbSelectModule } from '@nebular/theme';
import { RoleFormFieldComponent } from './role.component';

@NgModule({
	declarations: [RoleFormFieldComponent],
	exports: [RoleFormFieldComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, NbSelectModule, I18nTranslateModule.forChild()]
})
export class RoleFormFieldModule {}
