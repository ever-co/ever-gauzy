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
import { TranslateModule } from '@ngx-translate/core';
import { GoalLevelSelectModule } from '@gauzy/ui-core/shared';
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
		TranslateModule.forChild()
	],
	exports: [GoalTemplateSelectComponent]
})
export class GoalTemplateSelectModule {}
