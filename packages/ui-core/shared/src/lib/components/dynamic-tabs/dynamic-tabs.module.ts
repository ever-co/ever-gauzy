import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbRouteTabsetModule, NbTabsetModule } from '@nebular/theme';
import { DynamicTabsComponent } from './dynamic-tabs.component';

@NgModule({
	imports: [CommonModule, NbTabsetModule, NbRouteTabsetModule],
	declarations: [DynamicTabsComponent],
	exports: [DynamicTabsComponent]
})
export class DynamicTabsModule {}
