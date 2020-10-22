import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatchingRoutingModule } from './matching-routing.module';
import { MatchingComponent } from './matching/matching.component';

@NgModule({
	declarations: [MatchingComponent],
	imports: [CommonModule, MatchingRoutingModule]
})
export class MatchingModule {}
