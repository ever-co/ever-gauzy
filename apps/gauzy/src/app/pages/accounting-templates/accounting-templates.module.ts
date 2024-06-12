import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbLayoutModule, NbCardModule, NbSelectModule, NbButtonModule } from '@nebular/theme';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { LanguageSelectorModule, SharedModule } from '@gauzy/ui-sdk/shared';
import { AccountingTemplatesRoutingModule } from './accounting-templates-routing.module';
import { AccountingTemplatesComponent } from './accounting-templates.component';

@NgModule({
	imports: [
		NbLayoutModule,
		CommonModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		I18nTranslateModule.forChild(),
		NbButtonModule,
		AceEditorModule,
		SharedModule,
		LanguageSelectorModule,
		AccountingTemplatesRoutingModule
	],
	providers: [],
	declarations: [AccountingTemplatesComponent]
})
export class AccountingTemplatesModule {}
