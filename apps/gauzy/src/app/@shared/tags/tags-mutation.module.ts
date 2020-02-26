import { ThemeModule } from '../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbIconModule, NbDatepickerModule, NbInputModule, NbSelectModule, NbCheckboxModule, NbTooltipModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { EmployeeSelectorsModule, HttpLoaderFactory } from '../../@theme/components/header/selectors/employee/employee.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TagsMutationComponent } from './tags-mutation.component';
import { TagsService } from '../../@core/services/tags.service';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		NbDatepickerModule,
		NbInputModule,
		NbSelectModule,
		NbCheckboxModule,
		NbTooltipModule,
		EmployeeSelectorsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [TagsMutationComponent],
	entryComponents: [TagsMutationComponent],
	providers: [TagsService]	

})

export class TagsMutationModule{}