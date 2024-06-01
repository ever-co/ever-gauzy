import { NgModule } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { MiscellaneousRoutingModule } from './miscellaneous-routing.module';
import { MiscellaneousComponent } from './miscellaneous.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [ThemeModule, NbCardModule, MiscellaneousRoutingModule, I18nTranslateModule.forChild()],
	declarations: [MiscellaneousComponent, NotFoundComponent]
})
export class MiscellaneousModule {}
