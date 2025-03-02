import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, Router } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { IPipeline } from '@gauzy/contracts';
import { ErrorHandlingService, PipelinesService, Store } from '@gauzy/ui-core/core';

/**
 * Resolves a pipeline entity by its ID from the route parameters.
 *
 * @param route - The activated route snapshot containing route information.
 * @returns An observable of the pipeline entity or null.
 */
export const PipelineResolver: ResolveFn<Observable<IPipeline>> = (
	route: ActivatedRouteSnapshot
): Observable<IPipeline> => {
	// Injecting the necessary services
	const store = inject(Store);
	const router = inject(Router);
	const pipelinesService = inject(PipelinesService);
	const errorHandlingService = inject(ErrorHandlingService);

	// Extracting pipeline ID from route parameters
	const pipelineId = route.params['pipelineId'];
	if (!pipelineId) {
		return of(null); // Return null if pipeline ID is not present
	}

	// Extracting organization ID and tenant ID from store
	const { id: organizationId, tenantId } = store.selectedOrganization;

	// Get pipeline entity from the service
	return pipelinesService.getById(pipelineId, { organizationId, tenantId }, ['stages', 'createdByUser']).pipe(
		map((pipeline: IPipeline) => {
			if (pipeline.organizationId !== organizationId) {
				router.navigate(['pages/sales/pipelines']);
				return null; // Return null if organization ID does not match
			}
			return pipeline;
		}),
		catchError((error) => {
			// Handle and log errors
			errorHandlingService.handleError(error);
			return of(null); // Return null on error
		})
	);
};
