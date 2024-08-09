import { NgModule } from '@angular/core';
import { NbLayoutModule, NbCardModule, NbSelectModule, NbButtonModule } from '@nebular/theme';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageSelectorModule, SharedModule } from '@gauzy/ui-core/shared';
import { AccountingTemplatesRoutingModule } from './accounting-templates-routing.module';
import { AccountingTemplatesComponent } from './accounting-templates.component';

@NgModule({
	imports: [
		NbButtonModule,
		NbCardModule,
		NbLayoutModule,
		NbSelectModule,
		AceEditorModule,
		TranslateModule.forChild(),
		SharedModule,
		LanguageSelectorModule,
		AccountingTemplatesRoutingModule
	],
	declarations: [AccountingTemplatesComponent],
	providers: []
})
export class AccountingTemplatesModule {}
