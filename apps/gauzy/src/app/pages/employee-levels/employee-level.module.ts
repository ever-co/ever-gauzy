import { NgModule } from '@angular/core';
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
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { EmployeeLevelComponent } from './employee-level.component';
import { EmployeeLevelRoutingModule } from './employee-level-routing.module';

@NgModule({
	imports: [
		SharedModule,
		NbCardModule,
		NbButtonModule,
		EmployeeLevelRoutingModule,
		NbInputModule,
		NbIconModule,
		TagsColorInputModule,
		NbActionsModule,
		NbDialogModule,
		TableComponentsModule,
		TagsColorInputModule,
		NbActionsModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		NbTooltipModule,
		SmartDataViewLayoutModule,
		NbSpinnerModule
	],
	declarations: [EmployeeLevelComponent],
	providers: []
})
export class EmployeeLevelModule {}
