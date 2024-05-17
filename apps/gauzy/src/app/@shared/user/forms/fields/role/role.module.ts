import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbSelectModule } from '@nebular/theme';
import { RoleFormFieldComponent } from './role.component';

@NgModule({
	declarations: [RoleFormFieldComponent],
	exports: [RoleFormFieldComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, NbSelectModule, TranslateModule]
})
export class RoleFormFieldModule {}
