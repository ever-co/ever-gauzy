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
import { TranslateModule } from '@ngx-translate/core';
import { AlertDirective, ConfirmDirective, PromptDirective } from './directive';
import { AlertComponent } from './alert/alert.component';
import { ConfirmComponent } from './confirm/confirm.component';
import { PromptComponent } from './prompt/prompt.component';
import { QuickActionsComponent } from './quick-actions/quick-actions.component';

const Directives = [AlertDirective, ConfirmDirective, PromptDirective];
const Components = [AlertComponent, ConfirmComponent, PromptComponent, QuickActionsComponent];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbDialogModule,
		NbFormFieldModule,
		NbIconModule,
		NbInputModule,
		NbListModule,
		NbMenuModule,
		NbRadioModule,
		NbSelectModule,
		NbTagModule,
		TranslateModule.forChild()
	],
	declarations: [...Components, ...Directives],
	exports: [...Directives],
	providers: []
})
export class DialogsModule {}
