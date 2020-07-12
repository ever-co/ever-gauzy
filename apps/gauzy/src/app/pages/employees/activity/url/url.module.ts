import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UrlRoutingModule } from './url-routing.module';
import { UrlComponent } from './url/url.component';

@NgModule({
	declarations: [UrlComponent],
	imports: [CommonModule, UrlRoutingModule]
})
export class UrlModule {}
