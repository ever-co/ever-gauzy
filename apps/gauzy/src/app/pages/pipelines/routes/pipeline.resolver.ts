import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { IPipeline } from '@gauzy/contracts';
import { ErrorHandlingService, PipelinesService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';

@Injectable()
export class PipelineResolver implements Resolve<Observable<IPipeline | Observable<never>>> {
	constructor(
		private readonly _store: Store,
		private readonly _router: Router,
		private readonly _pipelinesService: PipelinesService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	/**
	 * Resolves a pipeline entity by its ID from the route parameters.
	 *
	 * @param route - The activated route snapshot containing route information.
	 * @returns An observable of the pipeline entity.
	 */
	resolve(route: ActivatedRouteSnapshot): Observable<IPipeline> {
		const pipelineId = route.params['pipelineId'];
		if (!pipelineId) {
			return of(null);
		}

		const { id: organizationId, tenantId } = this._store.selectedOrganization;
		return this._pipelinesService.getById(pipelineId, { organizationId, tenantId }, ['stages']).pipe(
			map((pipeline: IPipeline) => {
				if (pipeline.organizationId !== organizationId) {
					this._router.navigate(['pages/sales/pipelines']);
				}
				return pipeline;
			}),
			catchError((error) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of(error);
			})
		);
	}
}
