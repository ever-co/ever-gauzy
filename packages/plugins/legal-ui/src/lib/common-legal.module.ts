import { NgModule } from '@angular/core';
import { TermsAndConditionsComponent } from './components/terms-and-conditions/terms-and-conditions.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';

@NgModule({
	declarations: [TermsAndConditionsComponent, PrivacyPolicyComponent],
	exports: [TermsAndConditionsComponent, PrivacyPolicyComponent]
})
export class CommonLegalModule {}
