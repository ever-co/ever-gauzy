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
		TableComponentsModule
	],
	declarations: [ContactViewComponent]
})
export class ContactViewModule {}
