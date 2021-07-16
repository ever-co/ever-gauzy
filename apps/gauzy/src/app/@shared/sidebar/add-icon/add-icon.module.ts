import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { AddIconComponent } from './add-icon.component';
import { TranslateModule } from '../../translate/translate.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		TranslateModule
	],
	declarations: [AddIconComponent],
	exports: [AddIconComponent]
})
export class AddIconModule {}
