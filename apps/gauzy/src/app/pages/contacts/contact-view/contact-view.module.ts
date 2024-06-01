import { NgModule } from '@angular/core';
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
import { ThemeModule } from '../../../@theme/theme.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ContactViewComponent } from './contact-view.component';
import { ContactViewRoutingModule } from './contact-view-routing.module';
import { LeafletMapModule } from '../../../@shared/forms';
import { SharedModule } from '../../../@shared/shared.module';
import { EmployeeMultiSelectModule } from '../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { TableComponentsModule } from '../../../@shared';

@NgModule({
	imports: [
		ContactViewRoutingModule,
		ThemeModule,
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
	declarations: [ContactViewComponent],
	providers: []
})
export class ContactViewModule {}
