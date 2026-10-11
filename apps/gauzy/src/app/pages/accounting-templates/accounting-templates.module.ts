import { NgModule } from '@angular/core';
import {
	NbLayoutModule,
	NbCardModule,
	NbSelectModule,
	NbButtonModule,
	NbIconModule,
	NbDialogModule
} from '@nebular/theme';
import { AceEditorModule } from 'ngx-ace-editor-wrapper';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageSelectorModule, SharedModule } from '@gauzy/ui-core/shared';
import { AccountingTemplatesRoutingModule } from './accounting-templates-routing.module';
import { AccountingTemplatesComponent } from './accounting-templates.component';
import { SandboxedSrcdocDirective } from './sandboxed-srcdoc.directive';

@NgModule({
	imports: [
		NbButtonModule,
		NbCardModule,
		NbLayoutModule,
		NbSelectModule,
		NbIconModule,
		NbDialogModule.forChild(),
		AceEditorModule,
		TranslateModule.forChild(),
		SharedModule,
		LanguageSelectorModule,
		AccountingTemplatesRoutingModule
	],
	declarations: [AccountingTemplatesComponent, SandboxedSrcdocDirective],
	providers: []
})
export class AccountingTemplatesModule {}
