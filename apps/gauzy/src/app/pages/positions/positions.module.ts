import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	NoDataMessageModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { OrganizationPositionsService } from '@gauzy/ui-core/core';
import { PositionsRoutingModule } from './positions-routing.module';
import { PositionsComponent } from './positions.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbActionsModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forRoot(),
		NbIconModule,
		NbInputModule,
		NbTooltipModule,
		TranslateModule.forChild(),
		SharedModule,
		TableComponentsModule,
		CardGridModule,
		PositionsRoutingModule,
		TagsColorInputModule,
		SmartDataViewLayoutModule,
		NoDataMessageModule
	],
	declarations: [PositionsComponent],
	providers: [OrganizationPositionsService]
})
export class PositionsModule {}
