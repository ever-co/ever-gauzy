import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SplashScreenComponent } from './splash-screen.component';
import { NbLayoutModule, NbCardModule, NbSpinnerModule } from '@nebular/theme';

@NgModule({
	declarations: [SplashScreenComponent],
	imports: [CommonModule, NbLayoutModule, NbCardModule, NbSpinnerModule],
	exports: [SplashScreenComponent]
})
export class SplashScreenModule {}
