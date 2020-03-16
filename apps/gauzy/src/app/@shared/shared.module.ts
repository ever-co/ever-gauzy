import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';

@NgModule({
	declarations: [],
	imports: [CommonModule, BackNavigationModule],
	exports: [BackNavigationModule]
})
export class SharedModule {}
