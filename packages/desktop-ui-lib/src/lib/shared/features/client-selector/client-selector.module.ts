import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ClientSelectorComponent } from './client-selector.component';

@NgModule({
	declarations: [ClientSelectorComponent],
	exports: [ClientSelectorComponent],
	imports: [CommonModule]
})
export class ClientSelectorModule {}
