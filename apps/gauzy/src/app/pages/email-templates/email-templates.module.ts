import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { TranslateModule } from '@ngx-translate/core';
import { EmailTemplateService } from '@gauzy/ui-core/core';
import { LanguageSelectorModule, TableComponentsModule, UserFormsModule } from '@gauzy/ui-core/shared';
import { EmailTemplatesRoutingModule } from './email-templates-routing.module';
import { EmailTemplatesComponent } from './email-templates.component';

@NgModule({
	imports: [
		NbLayoutModule,
		CommonModule,
		EmailTemplatesRoutingModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		NbDialogModule.forChild(),
		TableComponentsModule,
		TranslateModule.forChild(),
		NbSpinnerModule,
		AceEditorModule,
		LanguageSelectorModule
	],
	providers: [EmailTemplateService],
	declarations: [EmailTemplatesComponent]
})
export class EmailTemplatesModule {}
