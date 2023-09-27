import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { Pipes } from './pipes';
import { Components } from './components';
import { RouterModule } from '@angular/router';
import { AlertModalModule } from './alert-modal';
import { NgxPermissionsModule } from 'ngx-permissions';
import { DirectivesModule } from './directives/directives.module';
import { EmployeeStartWorkModule } from './employee/employee-start-work/employee-start-work.module';
import { TaskBadgeViewComponent } from './tasks/task-badge-view/task-badge-view.component';

const Modules = [
	NgxPermissionsModule,
	BackNavigationModule,
	DirectivesModule,
	EmployeeStartWorkModule,
];

@NgModule({
	declarations: [...Pipes, ...Components, TaskBadgeViewComponent],
	imports: [CommonModule, RouterModule, ...Modules],
	exports: [
		AlertModalModule,
		...Pipes,
		...Components,
		...Modules,
		TaskBadgeViewComponent,
	],
	providers: [...Pipes],
})
export class SharedModule {
	static forRoot(): ModuleWithProviders<SharedModule> {
		return {
			ngModule: SharedModule,
			providers: [],
		};
	}
}
