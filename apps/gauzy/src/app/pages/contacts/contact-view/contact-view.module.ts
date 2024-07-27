import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbAccordionModule,
	NbCardModule,
	NbLayoutModule,
	NbListModule,
	NbRouteTabsetModule,
	NbSidebarModule,
	NbTabsetModule,
	NbTagModule,
	NbUserModule
} from '@nebular/theme';
import {
	EmployeeMultiSelectModule,
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
		CommonModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslateModule.forChild(),
		NbLayoutModule,
		NbSidebarModule,
		NbTabsetModule,
		NbUserModule,
		NbAccordionModule,
		NbTagModule,
		LeafletMapModule,
		NbListModule,
		SharedModule,
		EmployeeMultiSelectModule,
		TableComponentsModule
	],
	declarations: [ContactViewComponent]
})
export class ContactViewModule {}
