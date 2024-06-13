import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule,
	NbTooltipModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	CardGridModule,
	GauzyButtonActionModule,
	NoDataMessageModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-sdk/shared';
import { OrganizationPositionsService } from '@gauzy/ui-sdk/core';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { PositionsRoutingModule } from './positions-routing.module';
import { PositionsComponent } from './positions.component';
import { Angular2SmartTableModule } from 'angular2-smart-table';

@NgModule({
	imports: [
		SharedModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbActionsModule,
		TableComponentsModule,
		CardGridModule,
		Angular2SmartTableModule,
		PositionsRoutingModule,
		TagsColorInputModule,
		NbActionsModule,
		NbTooltipModule,
		NbDialogModule.forChild(),
		I18nTranslateModule.forChild(),
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	declarations: [PositionsComponent],
	providers: [OrganizationPositionsService]
})
export class PositionsModule {}
