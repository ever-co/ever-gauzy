import { ThemeModule } from '../../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
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
import { EventTypeMutationComponent } from './event-type-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeeMultiSelectModule } from './../../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { TagsColorInputModule } from '../../../../@shared/tags/tags-color-input/tags-color-input.module';

@NgModule({
	imports: [
		TagsColorInputModule,
		ThemeModule,
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
		TranslateModule
	],
	exports: [EventTypeMutationComponent],
	declarations: [EventTypeMutationComponent],
	providers: []
})
export class EventTypeMutationModule {}
