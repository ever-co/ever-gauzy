import { NgModule } from '@angular/core';
import {
	NbAccordionModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
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
import { TranslatePipe } from '@ngx-translate/core';
// Record-side Documents panel (spec 00 §6.14 R-LNK-02). Standalone, so it is
// imported directly — the Documents hub module is never pulled in here.
import { DocumentLinksPanelComponent } from '@gauzy/plugin-docs-ui';
// The Notes tab: the shared comments of a record, as the project page's Comments. Standalone.
import { EntityCommentsComponent } from '../../shared/entity-comments/entity-comments.component';
import { ContactViewComponent } from './contact-view.component';
import { ContactViewRoutingModule } from './contact-view-routing.module';

@NgModule({
	imports: [
		ContactViewRoutingModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslatePipe,
		NbLayoutModule,
		NbTabsetModule,
		NbUserModule,
		NbAccordionModule,
		NbTagModule,
		// The About panel puts the unbroken email / URL / fiscal string on a tooltip,
		// so a value that wraps across lines can still be read (and copied) in one piece.
		NbTooltipModule,
		// The remove action on each member row.
		NbButtonModule,
		NbIconModule,
		LeafletMapModule,
		NbListModule,
		SharedModule,
		EmployeeMultiSelectModule,
		FavoriteToggleModule,
		TableComponentsModule,
		DocumentLinksPanelComponent,
		EntityCommentsComponent
	],
	declarations: [ContactViewComponent]
})
export class ContactViewModule {}
