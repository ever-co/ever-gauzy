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
import { AceEditorModule } from 'ng2-ace-editor';
import { CommonModule } from '@angular/common';
import { TranslaterModule } from '../../@shared/translater/translater.module';

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
		TranslaterModule,
		NbSpinnerModule,
		AceEditorModule
	],
	providers: [EmailTemplateService],
	entryComponents: [EmailTemplatesComponent],
	declarations: [EmailTemplatesComponent]
})
export class EmailTemplatesModule {}
