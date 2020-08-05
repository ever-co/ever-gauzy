import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { EquipmentSharingPolicyComponent } from './equipment-sharing-policy.component';

const routes: Routes = [
	{
		path: '',
		component: EquipmentSharingPolicyComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EquipmentSharingPolicyRoutingModule {}
