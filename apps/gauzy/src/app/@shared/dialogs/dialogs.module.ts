import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
	NbDialogModule,
	NbRadioModule,
	NbListModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbCardModule,
	NbIconModule,
	NbCheckboxModule,
	NbFormFieldModule,
	NbMenuModule,
	NbBadgeModule,
	NbTagModule
} from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { AlertComponent } from './alert/alert.component';
import { ConfirmComponent } from './confirm/confirm.component';
import { PromptComponent } from './prompt/prompt.component';
import { AlertDirective } from './directive/alert.directive';
import { ConfirmDirective } from './directive/confirm.directive';
import { PromptDirective } from './directive/prompt.directive';

import { QuickActionsComponent } from './quick-actions/quick-actions.component';

const directives = [AlertDirective, ConfirmDirective, PromptDirective];

const components = [AlertComponent, ConfirmComponent, PromptComponent];

@NgModule({
	imports: [
		CommonModule,
		NbDialogModule,
		NbCheckboxModule,
		NbRadioModule,
		NbListModule,
		NbButtonModule,
		FormsModule,
		NbInputModule,
		ReactiveFormsModule,
		NbSelectModule,
		NbCardModule,
		NbIconModule,
		TranslateModule,
		NbFormFieldModule,
		NbMenuModule,
		NbBadgeModule,
		NbTagModule
	],
	declarations: [...components, ...directives, QuickActionsComponent],
	exports: [...directives],
	providers: []
})
export class DialogsModule {}
