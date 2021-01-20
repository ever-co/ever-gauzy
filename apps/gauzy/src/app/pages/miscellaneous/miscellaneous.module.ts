import { NgModule } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { MiscellaneousRoutingModule } from './miscellaneous-routing.module';
import { MiscellaneousComponent } from './miscellaneous.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		MiscellaneousRoutingModule,
		TranslaterModule
	],
	declarations: [MiscellaneousComponent, NotFoundComponent]
})
export class MiscellaneousModule {}
