import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbLayoutModule, NbCardModule, NbSelectModule, NbButtonModule } from '@nebular/theme';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageSelectorModule, SharedModule } from '@gauzy/ui-core/shared';
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
		TranslateModule.forChild(),
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
