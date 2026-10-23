import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { CandidateCriterionCardComponent } from './candidate-criterion-card.component';

@NgModule({
	imports: [CommonModule, ReactiveFormsModule, NbButtonModule, NbIconModule, NbInputModule, TranslatePipe],
	exports: [CandidateCriterionCardComponent],
	declarations: [CandidateCriterionCardComponent]
})
export class CandidateCriterionCardModule {}
