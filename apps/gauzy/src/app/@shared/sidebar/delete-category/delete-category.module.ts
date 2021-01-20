import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { DeleteCategoryComponent } from './delete-category.component';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		TranslaterModule
	],
	entryComponents: [DeleteCategoryComponent],
	declarations: [DeleteCategoryComponent],
	exports: [DeleteCategoryComponent]
})
export class DeleteCategoryModule {}
