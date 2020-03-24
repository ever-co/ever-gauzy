import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagsColorInputComponent } from './tags-color-input.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { NbBadgeModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../../@theme/components/header/selectors/employee/employee.module';
import { HttpClient } from '@angular/common/http';

@NgModule({
	imports: [
		CommonModule,
		NgSelectModule,
		NbBadgeModule,
		FormsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [TagsColorInputComponent],
	declarations: [TagsColorInputComponent]
})
export class TagsColorInputModule {}
