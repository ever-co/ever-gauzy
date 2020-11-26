import { NgModule } from '@angular/core';
import { LegalRoutingModule } from './legal-routing.module';
import { TermsAndConditionsComponent } from './terms-and-conditions/terms-and-conditions.component';

@NgModule({
	imports: [LegalRoutingModule],
	declarations: [TermsAndConditionsComponent]
})
export class LegalModule {}
