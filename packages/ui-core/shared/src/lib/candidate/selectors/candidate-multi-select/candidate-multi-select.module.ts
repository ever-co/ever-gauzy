import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../../shared.module';
import { CandidateMultiSelectComponent } from './candidate-multi-select.component';

@NgModule({
	imports: [CommonModule, NbSelectModule, TranslateModule.forChild(), SharedModule],
	declarations: [CandidateMultiSelectComponent],
	exports: [CandidateMultiSelectComponent]
})
export class CandidateMultiSelectModule {}
