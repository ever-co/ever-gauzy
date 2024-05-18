import { NgModule } from '@angular/core';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { DeleteInterviewComponent } from './delete-interview.component';
import { ThemeModule } from '../../../../@theme/theme.module';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbIconModule, NbButtonModule, TranslateModule],
	declarations: [DeleteInterviewComponent],
	exports: [DeleteInterviewComponent]
})
export class DeleteInterviewModule {}
