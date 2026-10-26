import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { TermsAndConditionsComponent } from './components/terms-and-conditions/terms-and-conditions.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';

@NgModule({
	imports: [CommonModule, TranslatePipe],
	declarations: [TermsAndConditionsComponent, PrivacyPolicyComponent],
	exports: [TermsAndConditionsComponent, PrivacyPolicyComponent]
})
export class CommonLegalModule {}
