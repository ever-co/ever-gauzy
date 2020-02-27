import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbIconModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TagsService } from '../../@core/services/tags.service';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/employee/employee.module';
import { ThemeModule } from '../../@theme/theme.module';
import { TagsMutationComponent } from './tags-mutation.component';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
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
export class TagsMutationModule {}
