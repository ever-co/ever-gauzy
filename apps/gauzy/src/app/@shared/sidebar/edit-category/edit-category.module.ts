import { NgModule } from '@angular/core';
import { ThemeModule, HttpLoaderFactory } from '../../../@theme/theme.module';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { EditCategoryComponent } from './edit-category.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ColorPickerModule, ColorPickerService } from 'ngx-color-picker';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbButtonModule,
		NbSelectModule,
		NbToggleModule,
		FormsModule,
		ReactiveFormsModule,
		ColorPickerModule,
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
	exports: [EditCategoryComponent],
	providers: [ColorPickerService]
})
export class EditCategoryModule {}
