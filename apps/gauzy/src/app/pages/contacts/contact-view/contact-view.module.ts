import { NgModule } from '@angular/core';
import {
	NbAccordionModule,
	NbCardModule,
	NbLayoutModule,
	NbListModule,
	NbRouteTabsetModule,
	NbTabsetModule,
	NbTagModule,
	NbTooltipModule,
	NbUserModule
} from '@nebular/theme';
import {
	EmployeeMultiSelectModule,
	FavoriteToggleModule,
	LeafletMapModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { TranslateModule } from '@ngx-translate/core';
// Record-side Documents panel (spec 00 §6.14 R-LNK-02). Standalone, so it is
// imported directly — the Documents hub module is never pulled in here.
import { DocumentLinksPanelComponent } from '@gauzy/plugin-docs-ui';
import { ContactViewComponent } from './contact-view.component';
import { ContactViewRoutingModule } from './contact-view-routing.module';

@NgModule({
	imports: [
		ContactViewRoutingModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslateModule.forChild(),
		NbLayoutModule,
		NbTabsetModule,
		NbUserModule,
		NbAccordionModule,
		NbTagModule,
		// The About panel puts the unbroken email / URL / fiscal string on a tooltip,
		// so a value that wraps across lines can still be read (and copied) in one piece.
		NbTooltipModule,
		LeafletMapModule,
		NbListModule,
		SharedModule,
		EmployeeMultiSelectModule,
		FavoriteToggleModule,
		TableComponentsModule,
		DocumentLinksPanelComponent
	],
	declarations: [ContactViewComponent]
})
export class ContactViewModule {}
