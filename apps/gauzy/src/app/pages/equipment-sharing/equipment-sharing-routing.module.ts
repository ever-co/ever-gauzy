import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { EquipmentSharingComponent } from './equipment-sharing.component';

const routes: Routes = [
	{
		path: '',
		component: EquipmentSharingComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EquipmentSharingRoutingModule {}
