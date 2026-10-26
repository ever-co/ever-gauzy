import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from '@gauzy/ui-core/shared';
import { InitiativesRoutingModule } from './initiatives-routing.module';
import { InitiativesComponent } from './initiatives.component';
import { InitiativeMutationComponent } from './initiative-mutation/initiative-mutation.component';
import { InitiativeDetailComponent } from './initiative-detail/initiative-detail.component';

/**
 * Goals → Initiatives (G-P2-4): the list, detail and create/edit of strategic initiatives, under the
 * `ORG_STRATEGIC_INITIATIVE_*` permissions.
 */
@NgModule({
	declarations: [InitiativesComponent, InitiativeMutationComponent, InitiativeDetailComponent],
	imports: [
		CommonModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		TranslatePipe,
		SharedModule,
		InitiativesRoutingModule
	]
})
export class InitiativesModule {}
