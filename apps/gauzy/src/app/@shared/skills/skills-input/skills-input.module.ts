import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkillsInputComponent } from './skills-input.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { NbBadgeModule } from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		CommonModule,
		NgSelectModule,
		NbBadgeModule,
		FormsModule,
		ReactiveFormsModule,
		TranslaterModule
	],
	exports: [SkillsInputComponent],
	declarations: [SkillsInputComponent]
})
export class SkillsInputModule {}
