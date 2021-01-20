import { NgModule } from '@angular/core';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { ThemeModule } from '../../../../@theme/theme.module';
import { DeleteFeedbackComponent } from './delete-feedback.component';
import { TranslaterModule } from '../../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		TranslaterModule
	],
	entryComponents: [DeleteFeedbackComponent],
	declarations: [DeleteFeedbackComponent],
	exports: [DeleteFeedbackComponent]
})
export class DeleteFeedbackModule {}
