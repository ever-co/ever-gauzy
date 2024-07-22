import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
	imports: [CommonModule]
})
export class UiAuthModule {
	constructor() {
		console.log('Ui Auth Module Loaded Successfully!');
	}
}
