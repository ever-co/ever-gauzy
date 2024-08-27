import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbRouteTabsetModule, NbTabsetModule } from '@nebular/theme';
import { DynamicTabsComponent } from './dynamic-tabs.component';

// Nebular Modules
const NB_MODULES = [NbTabsetModule, NbRouteTabsetModule];

@NgModule({
	imports: [CommonModule, ...NB_MODULES],
	declarations: [DynamicTabsComponent],
	exports: [DynamicTabsComponent]
})
export class DynamicTabsModule {}
