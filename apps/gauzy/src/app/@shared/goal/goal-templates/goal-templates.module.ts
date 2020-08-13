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
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { GoalCustomUnitModule } from '../goal-custom-unit/goal-custom-unit.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [GoalTemplatesComponent],
	entryComponents: [GoalTemplatesComponent]
})
export class GoalTemplatesModule {}
