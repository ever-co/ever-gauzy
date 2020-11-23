import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CustomSmtpComponent } from './custom-smtp.component';

const routes: Routes = [{ path: '', component: CustomSmtpComponent }];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class CustomSmtpRoutingModule {}
