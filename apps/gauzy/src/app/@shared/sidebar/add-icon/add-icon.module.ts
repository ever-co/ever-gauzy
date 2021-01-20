import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { AddIconComponent } from './add-icon.component';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		TranslaterModule
	],
	entryComponents: [AddIconComponent],
	declarations: [AddIconComponent],
	exports: [AddIconComponent]
})
export class AddIconModule {}
