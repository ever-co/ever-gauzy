import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { AboutComponent } from './about.component';
import { AboutRoutingModule } from './about-routing.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		TranslatePipe,
		AboutRoutingModule,
		SharedModule
	],
	declarations: [AboutComponent]
})
export class AboutModule {}
