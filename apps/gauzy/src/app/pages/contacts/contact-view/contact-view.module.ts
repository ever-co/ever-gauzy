import { NgModule } from '@angular/core';
import { NbAccordionModule, NbCardModule, NbLayoutModule, NbListModule, NbRouteTabsetModule, NbSidebarModule, NbTabsetModule, NbTagModule, NbUserModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { TranslateModule } from '../../../@shared/translate/translate.module';
import { ContactViewComponent } from './contact-view.component';
import { ContactViewRoutingModule } from './contact-view-routing.module';
import { LeafletMapModule } from '../../../@shared/forms';
import { SharedModule } from '../../../@shared/shared.module';
import { EmployeeMultiSelectModule } from '../../../@shared/employee/employee-multi-select/employee-multi-select.module';

@NgModule({
	imports: [
		ContactViewRoutingModule,
		ThemeModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslateModule,
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
	],
	declarations: [ContactViewComponent],
	providers: []
})
export class ContactViewModule { }
