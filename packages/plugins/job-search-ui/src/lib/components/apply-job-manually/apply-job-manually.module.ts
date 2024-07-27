import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	DirectivesModule,
	EmployeeMultiSelectModule,
	ProposalTemplateSelectModule,
	SelectorsModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { ApplyJobManuallyComponent } from './apply-job-manually.component';
import { JobTableComponentsModule } from '../job-table-components.module';

@NgModule({
	declarations: [ApplyJobManuallyComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbFormFieldModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		EmployeeMultiSelectModule,
		ProposalTemplateSelectModule,
		JobTableComponentsModule,
		DirectivesModule,
		SelectorsModule,
		SharedModule
	],
	exports: [TranslateModule],
	providers: []
})
export class ApplyJobManuallyModule {}
