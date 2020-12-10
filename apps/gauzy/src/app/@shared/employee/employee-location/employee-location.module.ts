import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbSelectModule,
	NbInputModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { EmployeeLocationComponent } from './employee-location.component';
import { CandidateStore } from '../../../@core/services/candidate-store.service';
import { EmployeeStore } from '../../../@core/services/employee-store.service';
import { LeafletMapModule } from '../../forms/maps/leaflet/leaflet.module';
import { LocationFormModule } from '../../forms/location';
@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbIconModule,
		ThemeModule,
		NbActionsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		LocationFormModule,
		LeafletMapModule
	],
	exports: [EmployeeLocationComponent],
	declarations: [EmployeeLocationComponent],
	entryComponents: [EmployeeLocationComponent],
	providers: [CandidateStore, EmployeeStore]
})
export class EmployeeLocationModule {}
