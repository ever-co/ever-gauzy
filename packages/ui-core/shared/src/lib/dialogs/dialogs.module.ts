import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
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
import { TranslatePipe } from '@ngx-translate/core';
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
		DragDropModule,
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
		TranslatePipe,
		...Directives
	],
	declarations: [...Components],
	exports: [...Directives],
	providers: []
})
export class DialogsModule {}
