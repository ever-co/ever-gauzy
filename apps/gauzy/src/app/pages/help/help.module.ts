import { NgModule } from '@angular/core';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { HelpComponent } from './help.component';
import { HelpRoutingModule } from './help-routing.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';

@NgModule({
	imports: [
		HelpRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [HelpComponent]
})
export class HelpModule {}
