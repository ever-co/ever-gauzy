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
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { GoalLevelSelectModule } from '../goal-level-select/goal-level-select.module';
import { HttpLoaderFactory } from '../../../@theme/theme.module';

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [GoalTemplateSelectComponent],
	entryComponents: [GoalTemplateSelectComponent]
})
export class GoalTemplateSelectModule {}
