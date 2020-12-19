import { NgModule } from '@angular/core';
import { LegalRoutingModule } from './legal-routing.module';
import { MainLegalModule } from '../@shared/legal/legal.module';
@NgModule({
	imports: [LegalRoutingModule, MainLegalModule],
	declarations: []
})
export class LegalModule {}
