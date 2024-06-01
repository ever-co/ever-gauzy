import { NgModule } from '@angular/core';
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
import { NgxPermissionsModule } from 'ngx-permissions';
import { ThemeModule } from '../../../@theme/theme.module';
import { RolePermissionsService } from '../../../@core/services';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { RolesPermissionsRoutingModule } from './roles-permissions-routing.module';
import { RolesPermissionsComponent } from './roles-permissions.component';

@NgModule({
	imports: [
		FormsModule,
		ReactiveFormsModule,
		RolesPermissionsRoutingModule,
		ThemeModule,
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
