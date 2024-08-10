import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule,
	NbTabsetModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	NoDataMessageModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { OrganizationEmploymentTypesService } from '@gauzy/ui-core/core';
import { EmploymentTypesRoutingModule } from './employment-types-routing.module';
import { EmploymentTypesComponent } from './employment-types.component';

@NgModule({
	imports: [
		SharedModule,
		CommonModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		EmploymentTypesRoutingModule,
		NbInputModule,
		NbIconModule,
		TagsColorInputModule,
		TableComponentsModule,
		CardGridModule,
		NbDialogModule,
		NbActionsModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild(),
		SmartDataViewLayoutModule,
		NbTabsetModule,
		NoDataMessageModule,
		NbTooltipModule,
		WorkInProgressModule
	],
	declarations: [EmploymentTypesComponent],
	providers: [OrganizationEmploymentTypesService]
})
export class EmploymentTypesModule {}
