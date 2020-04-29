import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ApprovalsRoutingModule } from './approvals-routing.module';
import { ApprovalsComponent } from './approvals/approvals.component';

@NgModule({
	declarations: [ApprovalsComponent],
	imports: [CommonModule, ApprovalsRoutingModule]
})
export class ApprovalsModule {}
