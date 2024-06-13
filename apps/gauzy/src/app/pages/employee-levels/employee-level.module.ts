import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule,
	NbTooltipModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	CardGridModule,
	GauzyButtonActionModule,
	NoDataMessageModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { EmployeeLevelComponent } from './employee-level.component';
import { EmployeeLevelRoutingModule } from './employee-level-routing.module';

@NgModule({
	imports: [
		CommonModule,
		SharedModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		EmployeeLevelRoutingModule,
		NbInputModule,
		NbIconModule,
		TagsColorInputModule,
		NbActionsModule,
		CardGridModule,
		Angular2SmartTableModule,
		NbDialogModule,
		TableComponentsModule,
		TagsColorInputModule,
		NbActionsModule,
		NbDialogModule.forChild(),
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		NbTooltipModule,
		GauzyButtonActionModule,
		NoDataMessageModule,
		NbSpinnerModule
	],
	declarations: [EmployeeLevelComponent],
	providers: []
})
export class EmployeeLevelModule {}
