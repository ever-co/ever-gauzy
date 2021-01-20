import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalTemplatesComponent } from './goal-templates.component';
import {
	NbCardModule,
	NbInputModule,
	NbButtonModule,
	NbSelectModule
} from '@nebular/theme';
import { ReactiveFormsModule } from '@angular/forms';
import { GoalCustomUnitModule } from '../goal-custom-unit/goal-custom-unit.module';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	declarations: [GoalTemplatesComponent],
	imports: [
		CommonModule,
		NbCardModule,
		ReactiveFormsModule,
		NbInputModule,
		NbSelectModule,
		NbButtonModule,
		GoalCustomUnitModule,
		TranslaterModule
	],
	exports: [GoalTemplatesComponent],
	entryComponents: [GoalTemplatesComponent]
})
export class GoalTemplatesModule {}
