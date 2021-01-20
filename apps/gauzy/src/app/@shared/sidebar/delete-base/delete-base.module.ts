import { DeleteBaseComponent } from './delete-base.component';
import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		TranslaterModule
	],
	entryComponents: [DeleteBaseComponent],
	declarations: [DeleteBaseComponent],
	exports: [DeleteBaseComponent]
})
export class DeleteBaseModule {}
