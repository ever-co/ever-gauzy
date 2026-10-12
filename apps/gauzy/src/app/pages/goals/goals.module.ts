import { NgModule } from '@angular/core';
import { NbDialogModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { GoalsRoutingModule } from './goals-routing.module';

@NgModule({
	imports: [
		GoalsRoutingModule,
		NbDialogModule.forChild(),
		TranslatePipe,
		NgxPermissionsModule.forChild()
	]
})
export class GoalsModule {}
