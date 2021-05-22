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
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { EmailTemplatesRoutingModule } from './email-templates-routing.module';
import { EmailTemplatesComponent } from './email-templates.component';
import { EmailTemplateService } from '../../@core/services/email-template.service';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { LanguageSelectorModule } from '../../@shared/language/language-selector/language-selector.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';

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
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		TableComponentsModule,
		TranslateModule,
		NbSpinnerModule,
		AceEditorModule,
		LanguageSelectorModule,
		HeaderTitleModule
	],
	providers: [EmailTemplateService],
	declarations: [EmailTemplatesComponent]
})
export class EmailTemplatesModule {}
