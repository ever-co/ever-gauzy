import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbSelectModule } from '@nebular/theme';
import { TimeOffPolicySelectComponent } from './time-off-policy-select.component';

@NgModule({
	declarations: [TimeOffPolicySelectComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, NbSelectModule, I18nTranslateModule.forChild()],
	exports: [TimeOffPolicySelectComponent]
})
export class TimeOffPolicySelectModule {}
