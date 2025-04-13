import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LogoComponent } from './logo.component';
import { NbThemeModule } from '@nebular/theme';
@NgModule({
	declarations: [LogoComponent],
	imports: [CommonModule, NbThemeModule],
	exports: [LogoComponent],
	providers: []
})
export class LogoModule {}
