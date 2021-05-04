import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { SharedModule } from '../../@shared/shared.module';
import { OrganizationEmploymentTypesService } from '../../@core/services/organization-employment-types.service';
import { EmploymentTypesRoutingModule } from './employment-types-routing.module';
import { EmploymentTypesComponent } from './employment-types.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';

@NgModule({
	imports: [
		SharedModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		EmploymentTypesRoutingModule,
		NbInputModule,
		NbIconModule,
		TagsColorInputModule,
		NbActionsModule,
		TableComponentsModule,
		CardGridModule,
		NbDialogModule,
		Ng2SmartTableModule,
		NbActionsModule,
		NbDialogModule.forChild(),
		TranslateModule,
		HeaderTitleModule
	],
	declarations: [EmploymentTypesComponent],
	entryComponents: [],
	providers: [OrganizationEmploymentTypesService]
})
export class EmploymentTypesModule {}
