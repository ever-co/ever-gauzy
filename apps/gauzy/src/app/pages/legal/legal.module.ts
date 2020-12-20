import { NgModule } from '@angular/core';
import { MainLegalModule } from '../../@shared/legal/legal.module';
import { PageLegalRoutingModule } from './legal-routing.module';

@NgModule({
	imports: [PageLegalRoutingModule, MainLegalModule],
	declarations: []
})
export class PageLegalModule {}
