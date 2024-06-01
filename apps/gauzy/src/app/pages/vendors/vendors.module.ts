import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule,
	NbBadgeModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { VendorsComponent } from './vendors.component';
import { OrganizationVendorsService } from '../../@core/services/organization-vendors.service';
import { VendorsRoutingModule } from './vendors-routing.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { SharedModule } from '../../@shared/shared.module';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NoDataMessageModule } from '../../@shared/no-data-message/no-data-message.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		ReactiveFormsModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbTooltipModule,
		TagsColorInputModule,
		NbActionsModule,
		TableComponentsModule,
		VendorsRoutingModule,
		NbBadgeModule,
		CardGridModule,
		NbDialogModule,
		SharedModule,
		Angular2SmartTableModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild(),
		HeaderTitleModule,
		GauzyButtonActionModule,
		NbSpinnerModule,
		InfiniteScrollModule,
		NoDataMessageModule
	],
	declarations: [VendorsComponent],
	providers: [OrganizationVendorsService]
})
export class VendorsModule {}
