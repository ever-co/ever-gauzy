import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbInputModule,
	NbAccordionModule,
	NbStepperModule,
	NbButtonModule,
	NbSelectModule,
	NbIconModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GoalLevelSelectModule } from '@gauzy/ui-sdk/shared';
import { GoalTemplateSelectComponent } from './goal-template-select.component';

@NgModule({
	declarations: [GoalTemplateSelectComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbInputModule,
		NbAccordionModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		FormsModule,
		ReactiveFormsModule,
		NbIconModule,
		NbStepperModule,
		GoalLevelSelectModule,
		I18nTranslateModule.forChild()
	],
	exports: [GoalTemplateSelectComponent]
})
export class GoalTemplateSelectModule {}
