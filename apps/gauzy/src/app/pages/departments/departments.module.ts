import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbTooltipModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { OrganizationDepartmentsService } from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import {
	CardGridModule,
	EmployeeMultiSelectModule,
	EntityWithMembersModule,
	FileUploaderModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { DepartmentsComponent } from './departments.component';
import { DepartmentsRoutingModule } from './departments-routing.module';
import { DepartmentsMutationComponent } from './departments-mutation/departments-mutation.component';

const COMPONENTS = [DepartmentsComponent, DepartmentsMutationComponent];

@NgModule({
	imports: [
		CommonModule,
		SharedModule,
		DepartmentsRoutingModule,
		NbCardModule,
		FormsModule,
		NbDialogModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		NbDialogModule.forChild(),
		NbTooltipModule,
		FileUploaderModule,
		NgSelectModule,
		CardGridModule,
		Angular2SmartTableModule,
		EntityWithMembersModule,
		TagsColorInputModule,
		EmployeeMultiSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		PaginationV2Module,
		GauzyButtonActionModule,
		TableComponentsModule
	],
	declarations: [...COMPONENTS],
	providers: [OrganizationDepartmentsService]
})
export class DepartmentsModule {}
