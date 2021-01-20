import { NgModule } from '@angular/core';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { DeleteInterviewComponent } from './delete-interview.component';
import { ThemeModule } from '../../../../@theme/theme.module';
import { TranslateModule } from '../../../translate/translate.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		TranslateModule
	],
	entryComponents: [DeleteInterviewComponent],
	declarations: [DeleteInterviewComponent],
	exports: [DeleteInterviewComponent]
})
export class DeleteInterviewModule {}
