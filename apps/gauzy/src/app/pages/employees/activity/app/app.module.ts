import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app/app.component';

@NgModule({
	declarations: [AppComponent],
	imports: [CommonModule, AppRoutingModule]
})
export class AppModule {}
