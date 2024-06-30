import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';

@NgModule({
	imports: [CommonModule, I18nTranslateModule]
})
export class UiAuthModule {
	constructor() {
		console.log('Ui Auth Module Loaded Successfully!');
	}
}
