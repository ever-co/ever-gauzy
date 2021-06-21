import { NgModule } from '@angular/core';
import { Routes, RouterModule, ActivatedRouteSnapshot, ActivatedRoute } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { filter, tap } from 'rxjs/operators';
import { Store } from '../../../@core/services';
import { ImportComponent } from './import.component';

const routes: Routes = [
	{
		path: '',
		component: ImportComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: (route: ActivatedRouteSnapshot) => {
					const token = route.queryParamMap.get('token');
					const userId = route.queryParamMap.get('userId');
					if (token && userId) {
						return []
					} else {
						return [PermissionsEnum.IMPORT_EXPORT_VIEW]
					}
				},
				redirectTo: '/pages/settings'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ImportRoutingModule {

	constructor(
		private readonly _store: Store,
		private readonly _activatedRoute: ActivatedRoute,
	) {
		_activatedRoute.queryParamMap
			.pipe(
				filter((params) => !!params && !!params.get('token')),
				tap((params) => {
					_store.token = params.get('token');
            		_store.userId = params.get('userId');
				})
			)
			.subscribe();
	}
}
