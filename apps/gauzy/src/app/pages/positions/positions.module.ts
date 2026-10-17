import { NgModule } from '@angular/core';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { OrganizationPositionsService } from '@gauzy/ui-core/core';
import { PositionsRoutingModule } from './positions-routing.module';
import { PositionsComponent } from './positions.component';

@NgModule({
	imports: [
		NbActionsModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forRoot(),
		NbIconModule,
		NbInputModule,
		NbTooltipModule,
		TranslatePipe,
		SharedModule,
		TableComponentsModule,
		CardGridModule,
		PositionsRoutingModule,
		TagsColorInputModule,
		SmartDataViewLayoutModule
	],
	declarations: [PositionsComponent],
	providers: [OrganizationPositionsService]
})
export class PositionsModule {}
