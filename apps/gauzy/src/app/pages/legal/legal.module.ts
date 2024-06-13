import { NgModule } from '@angular/core';
import { MainLegalModule } from '@gauzy/ui-sdk/shared';
import { PageLegalRoutingModule } from './legal-routing.module';

@NgModule({
	imports: [PageLegalRoutingModule, MainLegalModule],
	declarations: []
})
export class PageLegalModule {}
