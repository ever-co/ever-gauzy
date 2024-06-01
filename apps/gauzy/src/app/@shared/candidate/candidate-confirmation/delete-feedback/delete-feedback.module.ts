import { NgModule } from '@angular/core';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../../@theme/theme.module';
import { DeleteFeedbackComponent } from './delete-feedback.component';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbIconModule, NbButtonModule, TranslateModule.forChild()],
	declarations: [DeleteFeedbackComponent],
	exports: [DeleteFeedbackComponent]
})
export class DeleteFeedbackModule {}
