import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbLayoutModule, NbCardModule, NbSelectModule, NbButtonModule } from '@nebular/theme';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { LanguageSelectorModule } from '../../@shared/language/language-selector/language-selector.module';
import { SharedModule } from '../../@shared/shared.module';
import { ThemeModule } from '../../@theme/theme.module';
import { AccountingTemplatesRoutingModule } from './accounting-templates-routing.module';
import { AccountingTemplatesComponent } from './accounting-templates.component';

@NgModule({
	imports: [
		NbLayoutModule,
		CommonModule,
		ThemeModule,
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
