import { NgModule } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { MiscellaneousRoutingModule } from './miscellaneous-routing.module';
import { MiscellaneousComponent } from './miscellaneous.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		MiscellaneousRoutingModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [MiscellaneousComponent, NotFoundComponent]
})
export class MiscellaneousModule {}
