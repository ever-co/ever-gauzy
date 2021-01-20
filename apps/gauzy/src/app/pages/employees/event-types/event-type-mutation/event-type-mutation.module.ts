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
import { EmployeeSelectorsModule } from '../../../../@theme/components/header/selectors/employee/employee.module';
import { TagsColorInputModule } from '../../../../@shared/tags/tags-color-input/tags-color-input.module';
import { TranslaterModule } from '../../../../@shared/translater/translater.module';

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
		EmployeeSelectorsModule,
		NbCheckboxModule,
		NbTooltipModule,
		TranslaterModule
	],
	exports: [EventTypeMutationComponent],
	declarations: [EventTypeMutationComponent],
	entryComponents: [EventTypeMutationComponent],
	providers: []
})
export class EventTypeMutationModule {}
