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
import { TranslatePipe } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { RolePermissionsService } from '@gauzy/ui-core/core';
import { SharedModule } from '@gauzy/ui-core/shared';
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
		TranslatePipe,
		SharedModule
	],
	declarations: [RolesPermissionsComponent],
	providers: [RolePermissionsService]
})
export class RolesPermissionsModule {}
