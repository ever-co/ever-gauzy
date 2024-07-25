import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DeleteInterviewComponent } from './delete-interview.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbCardModule, NbIconModule, TranslateModule.forChild()],
	declarations: [DeleteInterviewComponent],
	exports: [DeleteInterviewComponent]
})
export class DeleteInterviewModule {}
