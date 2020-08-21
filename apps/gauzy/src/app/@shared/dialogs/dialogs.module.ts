import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { AlertComponent } from './alert/alert.component';
import { ConfirmComponent } from './confirm/confirm.component';
import { PromptComponent } from './prompt/prompt.component';
import { AlertDirective } from './directive/alert.directive';
import { ConfirmDirective } from './directive/confirm.directive';
import { PromptDirective } from './directive/prompt.directive';
import {
	NbDialogModule,
	NbRadioModule,
	NbListModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbCardModule,
	NbIconModule,
	NbCheckboxModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

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
		TranslateModule
	],
	declarations: [...components, ...directives],
	exports: [...directives],
	entryComponents: [...components],
	providers: []
})
export class DialogsModule {}
