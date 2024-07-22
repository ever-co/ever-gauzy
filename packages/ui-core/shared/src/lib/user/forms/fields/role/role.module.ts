import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { NbSelectModule } from '@nebular/theme';
import { RoleFormFieldComponent } from './role.component';

@NgModule({
	declarations: [RoleFormFieldComponent],
	exports: [RoleFormFieldComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, NbSelectModule, I18nTranslateModule.forChild()]
})
export class RoleFormFieldModule {}
