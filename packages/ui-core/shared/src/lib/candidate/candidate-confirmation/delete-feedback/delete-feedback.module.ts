import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DeleteFeedbackComponent } from './delete-feedback.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbCardModule, NbIconModule, TranslateModule.forChild()],
	declarations: [DeleteFeedbackComponent],
	exports: [DeleteFeedbackComponent]
})
export class DeleteFeedbackModule {}
