import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { CandidateCriterionCardComponent } from './candidate-criterion-card.component';

@NgModule({
	imports: [CommonModule, ReactiveFormsModule, NbButtonModule, NbIconModule, NbInputModule, TranslateModule.forChild()],
	exports: [CandidateCriterionCardComponent],
	declarations: [CandidateCriterionCardComponent]
})
export class CandidateCriterionCardModule {}
