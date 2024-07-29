import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbAutocompleteModule,
	NbButtonModule,
	NbCardModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { RolePermissionsService } from '@gauzy/ui-core/core';
import { RolesPermissionsRoutingModule } from './roles-permissions-routing.module';
import { RolesPermissionsComponent } from './roles-permissions.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		RolesPermissionsRoutingModule,
		NbAutocompleteModule,
		NbButtonModule,
		NbCardModule,
		NbFormFieldModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild()
	],
	declarations: [RolesPermissionsComponent],
	providers: [RolePermissionsService]
})
export class RolesPermissionsModule {}
