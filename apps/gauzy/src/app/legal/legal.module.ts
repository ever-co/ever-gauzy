import { NgModule } from '@angular/core';
import { MainLegalModule } from '@gauzy/ui-sdk/shared';
import { LegalRoutingModule } from './legal-routing.module';

@NgModule({
	imports: [LegalRoutingModule, MainLegalModule],
	declarations: []
})
export class LegalModule {}
