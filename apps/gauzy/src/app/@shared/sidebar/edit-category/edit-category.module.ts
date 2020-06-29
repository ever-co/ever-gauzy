import { NgModule } from '@angular/core';
import { ThemeModule, HttpLoaderFactory } from '../../../@theme/theme.module';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { EditCategoryComponent } from './edit-category.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbButtonModule,
		NbSelectModule,
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
	entryComponents: [EditCategoryComponent],
	declarations: [EditCategoryComponent],
	exports: [EditCategoryComponent]
})
export class EditCategoryModule {}
