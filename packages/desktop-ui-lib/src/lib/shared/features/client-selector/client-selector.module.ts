import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SelectModule } from '../../components/ui/select/select.module';
import { ClientSelectorComponent } from './client-selector.component';

@NgModule({
	declarations: [ClientSelectorComponent],
	exports: [ClientSelectorComponent],
	imports: [CommonModule, SelectModule]
})
export class ClientSelectorModule {}
