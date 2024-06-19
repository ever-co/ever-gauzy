import { NgModule } from '@angular/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { TermsAndConditionsComponent } from './terms-and-conditions/terms-and-conditions.component';

@NgModule({
	imports: [I18nTranslateModule.forChild()],
	declarations: [TermsAndConditionsComponent, PrivacyPolicyComponent],
	exports: [TermsAndConditionsComponent, PrivacyPolicyComponent]
})
export class MainLegalModule {}
