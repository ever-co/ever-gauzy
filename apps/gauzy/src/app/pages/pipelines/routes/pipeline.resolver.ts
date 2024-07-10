import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { IPipeline } from '@gauzy/contracts';
import { ErrorHandlingService, PipelinesService } from '@gauzy/ui-core/core';

@Injectable()
export class PipelineResolver implements Resolve<Observable<IPipeline | Observable<never>>> {
	constructor(
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
		const relations = route.data['relations'];

		if (!pipelineId) {
			return of(null);
		}

		return this._pipelinesService.getById(pipelineId, relations).pipe(
			catchError((error) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of(error);
			})
		);
	}
}
