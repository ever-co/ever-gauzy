import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { DeleteFeedbackComponent } from './delete-feedback.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbCardModule, NbIconModule, TranslatePipe],
	declarations: [DeleteFeedbackComponent],
	exports: [DeleteFeedbackComponent]
})
export class DeleteFeedbackModule {}
