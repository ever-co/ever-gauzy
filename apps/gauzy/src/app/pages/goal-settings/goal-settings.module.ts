import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GoalSettingsRoutingModule } from './goal-settings-routing.module';
import { GoalSettingsComponent } from './goal-settings.component';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbSelectModule,
	NbDatepickerModule,
	NbInputModule,
	NbDialogModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { EditTimeFrameComponent } from './edit-time-frame/edit-time-frame.component';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../@shared/shared.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	declarations: [GoalSettingsComponent, EditTimeFrameComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbIconModule,
		ReactiveFormsModule,
		Ng2SmartTableModule,
		NbButtonModule,
		NbSelectModule,
		NbDatepickerModule,
		NbInputModule,
		NbDatepickerModule,
		GoalSettingsRoutingModule,
		SharedModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	]
})
export class GoalSettingsModule {}
