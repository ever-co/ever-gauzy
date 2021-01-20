import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalTemplateSelectComponent } from './goal-template-select.component';
import {
	NbCardModule,
	NbInputModule,
	NbAccordionModule,
	NbStepperModule,
	NbButtonModule,
	NbSelectModule,
	NbIconModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { GoalLevelSelectModule } from '../goal-level-select/goal-level-select.module';
import { TranslateModule } from '../../translate/translate.module';

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
		TranslateModule
	],
	exports: [GoalTemplateSelectComponent],
	entryComponents: [GoalTemplateSelectComponent]
})
export class GoalTemplateSelectModule {}
