import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { HelpComponent } from './help.component';
import { HelpRoutingModule } from './help-routing.module';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbCardModule, NbInputModule, TranslateModule.forChild(), HelpRoutingModule],
	declarations: [HelpComponent]
})
export class HelpModule {}
