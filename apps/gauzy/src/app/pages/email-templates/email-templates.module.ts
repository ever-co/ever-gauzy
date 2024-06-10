import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbLayoutModule,
	NbSelectModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { EmailTemplatesRoutingModule } from './email-templates-routing.module';
import { EmailTemplatesComponent } from './email-templates.component';
import { EmailTemplateService } from '@gauzy/ui-sdk/core';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { CommonModule } from '@angular/common';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { LanguageSelectorModule } from '../../@shared/language/language-selector/language-selector.module';

@NgModule({
	imports: [
		NbLayoutModule,
		CommonModule,
		EmailTemplatesRoutingModule,
		ThemeModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		Angular2SmartTableModule,
		NbDialogModule.forChild(),
		TableComponentsModule,
		I18nTranslateModule.forChild(),
		NbSpinnerModule,
		AceEditorModule,
		LanguageSelectorModule
	],
	providers: [EmailTemplateService],
	declarations: [EmailTemplatesComponent]
})
export class EmailTemplatesModule {}
