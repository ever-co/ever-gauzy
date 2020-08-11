import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoalLevelSelectComponent } from './goal-level-select.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NbInputModule, NbSelectModule } from '@nebular/theme';
import { ReactiveFormsModule } from '@angular/forms';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	declarations: [GoalLevelSelectComponent],
	imports: [
		CommonModule,
		NbInputModule,
		ReactiveFormsModule,
		NbSelectModule,
		EmployeeMultiSelectModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [GoalLevelSelectComponent],
	entryComponents: [GoalLevelSelectComponent]
})
export class GoalLevelSelectModule {}
