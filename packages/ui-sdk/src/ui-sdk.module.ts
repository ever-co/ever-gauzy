import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from '@gauzy/ui-sdk/button';
import { UiSdkComponent } from './ui-sdk.component';

@NgModule({
	declarations: [UiSdkComponent],
	imports: [CommonModule, ButtonModule],
	exports: [UiSdkComponent],
	providers: []
})
export class UiSdkModule {
	constructor() {
		alert('Import Ui Sdk module in the AppModule only');
	}
}
