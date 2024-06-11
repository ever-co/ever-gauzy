import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbDatepickerModule,
	NbSelectModule,
	NbRadioModule,
	NbCheckboxModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeeMultiSelectModule, TagsColorInputModule } from '@gauzy/ui-sdk/shared';
import { EventTypeMutationComponent } from './event-type-mutation.component';

@NgModule({
	imports: [
		TagsColorInputModule,
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		ReactiveFormsModule,
		NbInputModule,
		FormsModule,
		NbDatepickerModule,
		NbSelectModule,
		NbRadioModule,
		EmployeeMultiSelectModule,
		NbCheckboxModule,
		NbTooltipModule,
		I18nTranslateModule.forChild()
	],
	exports: [EventTypeMutationComponent],
	declarations: [EventTypeMutationComponent],
	providers: []
})
export class EventTypeMutationModule {}
