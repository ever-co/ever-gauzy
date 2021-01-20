import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbToggleModule
} from '@nebular/theme';
import { EditCategoryComponent } from './edit-category.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ColorPickerModule, ColorPickerService } from 'ngx-color-picker';
import { TranslaterModule } from '../../translater/translater.module';

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
		TranslaterModule
	],
	entryComponents: [EditCategoryComponent],
	declarations: [EditCategoryComponent],
	exports: [EditCategoryComponent],
	providers: [ColorPickerService]
})
export class EditCategoryModule {}
