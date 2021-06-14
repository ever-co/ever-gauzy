import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SplashScreenComponent } from './splash-screen.component';
import { NbLayoutModule, NbCardModule } from '@nebular/theme';
@NgModule({
	declarations: [SplashScreenComponent],
	imports: [CommonModule, NbLayoutModule, NbCardModule],
	exports: [SplashScreenComponent]
})
export class SplashScreenModule {}
