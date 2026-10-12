import { NgModule } from '@angular/core';
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
import { TranslatePipe } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
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
		NbCardModule,
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
		TranslatePipe,
		SmartDataViewLayoutModule,
		NbTabsetModule,
		NbTooltipModule,
		WorkInProgressModule
	],
	declarations: [EmploymentTypesComponent],
	providers: [OrganizationEmploymentTypesService]
})
export class EmploymentTypesModule {}
