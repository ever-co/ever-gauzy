import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { PickEmployeeComponent } from './pick-employee.component';
import { PickEmployeeRoutingModule } from './pick-employee.routing.module';
import { NbCardModule, NbButtonModule, NbToastrModule } from '@nebular/theme';
import { EmployeeSelectorsModule } from '../../../@theme/components/header/selectors/employee/employee.module';
import { BackNavigationModule } from '../../../@shared/back-navigation/back-navigation.module';
import { EventTypeService } from '../../../@core/services/event-type.service';
@NgModule({
	imports: [
		ThemeModule,
		NbToastrModule,
		NbButtonModule,
		NbCardModule,
		EmployeeSelectorsModule,
		BackNavigationModule,
		PickEmployeeRoutingModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [PickEmployeeComponent],
	entryComponents: [PickEmployeeComponent],
	providers: [EventTypeService]
})
export class PickEmployeeModule {}
