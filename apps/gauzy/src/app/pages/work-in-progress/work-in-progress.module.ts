import { NgModule } from '@angular/core';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { WorkInProgressComponent } from './work-in-progress.component';
import { WorkInProgressRoutingModule } from './work-in-progress-routing.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
@NgModule({
	imports: [
		WorkInProgressRoutingModule,
		ThemeModule,
		NbCardModule,
		NbIconModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [WorkInProgressComponent]
})
export class WorkInProgressModule {}
