import { NgModule } from '@angular/core';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { TermsAndConditionsComponent } from './terms-and-conditions/terms-and-conditions.component';

@NgModule({
	imports: [I18nTranslateModule.forChild()],
	declarations: [TermsAndConditionsComponent, PrivacyPolicyComponent],
	exports: [TermsAndConditionsComponent, PrivacyPolicyComponent]
})
export class MainLegalModule {}
