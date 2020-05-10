import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkillsInputComponent } from './skills-input.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { NbBadgeModule } from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../../@theme/components/header/selectors/employee/employee.module';
import { HttpClient } from '@angular/common/http';

@NgModule({
	imports: [
		CommonModule,
		NgSelectModule,
		NbBadgeModule,
		FormsModule,
		ReactiveFormsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [SkillsInputComponent],
	declarations: [SkillsInputComponent]
})
export class SkillsInputModule {}
