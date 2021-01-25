import { Injectable } from '@angular/core';
import {
	IIntegrationViewModel,
	IIntegrationFilter,
	IntegrationTypeNameEnum,
	IntegrationTypeGroupEnum
} from '@gauzy/contracts';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { IntegrationsService } from './integrations.service';
import {
	tap,
	map,
	distinctUntilChanged,
	debounceTime,
	catchError,
	finalize,
	mergeMap
} from 'rxjs/operators';
import { DomSanitizer } from '@angular/platform-browser';
import { ErrorHandlingService } from './error-handling.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

export const InitialFilter: IIntegrationFilter = {
	integrationTypeId: '',
	searchQuery: '',
	filter: 'all'
};

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class IntegrationsStoreService {
	private _integrations$: BehaviorSubject<
		IIntegrationViewModel[]
	> = new BehaviorSubject([]);
	public integrations$: Observable<
		IIntegrationViewModel[]
	> = this._integrations$.asObservable();

	private _integrationGroups$: BehaviorSubject<any[]> = new BehaviorSubject(
		[]
	);
	public integrationGroups$: Observable<
		any[]
	> = this._integrationGroups$.asObservable();

	private _isLoading$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public isLoading$: Observable<boolean> = this._isLoading$.asObservable();

	private _selectedIntegrationTypeId$: BehaviorSubject<string> = new BehaviorSubject(
		InitialFilter.integrationTypeId
	);
	public selectedIntegrationTypeId$: Observable<string> = this._selectedIntegrationTypeId$.asObservable();

	private _selectedIntegrationFilter$: BehaviorSubject<string> = new BehaviorSubject(
		InitialFilter.filter
	);
	public selectedIntegrationFilter$: Observable<string> = this._selectedIntegrationFilter$.asObservable();

	private _filters$: BehaviorSubject<IIntegrationFilter> = new BehaviorSubject(
		InitialFilter
	);

	constructor(
		private sanitizer: DomSanitizer,
		private _integrationsService: IntegrationsService,
		private _errorHandlingService: ErrorHandlingService
	) {
		this._loadIntegrationGroups();
		this._loadIntegrations();
	}

	private _loadIntegrations() {
		this._filters$
			.pipe(
				distinctUntilChanged(
					(a, b) => JSON.stringify(a) === JSON.stringify(b)
				),
				debounceTime(300),
				mergeMap(({ integrationTypeId, searchQuery, filter }) => {
					return integrationTypeId
						? this._integrationsService.fetchIntegrations(
								integrationTypeId,
								searchQuery,
								filter
						  )
						: of([]);
				}),
				map((integrations) =>
					integrations.map((item) => ({
						...item,
						navigation_url: `../${item.name.toLowerCase()}`,
						imgSrc: this.sanitizer.bypassSecurityTrustResourceUrl(
							item.imgSrc
						)
					}))
				),
				tap((integrations) => this._integrations$.next(integrations)),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return of([]);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadIntegrationGroups() {
		this._integrationsService
			.fetchIntegrationGroups()
			.pipe(
				distinctUntilChanged(),
				tap(() => this._isLoading$.next(true)),
				tap((integrationGroups) =>
					this._integrationGroups$.next(integrationGroups)
				),
				map((integrationGroups) =>
					this._mapToDefaultType(integrationGroups)
				),
				tap((integrationType) =>
					this._selectedIntegrationTypeId$.next(integrationType.id)
				),
				tap((integrationType) =>
					this._filters$.next({
						integrationTypeId: integrationType.id,
						searchQuery: '',
						filter: 'all'
					})
				),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return of([]);
				}),
				finalize(() => this._isLoading$.next(false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _mapToDefaultType(integrationGroups) {
		const featuredGroup = integrationGroups.find(
			({ groupName }) => groupName === IntegrationTypeGroupEnum.FEATURED
		);
		return featuredGroup.integrationTypes.find(
			(item) => item.name === IntegrationTypeNameEnum.ALL_INTEGRATIONS
		);
	}

	setSelectedIntegrationTypeId(integrationTypeId: string) {
		this._selectedIntegrationTypeId$.next(integrationTypeId);
		const filterState = this._filters$.getValue();
		this._filters$.next({ ...filterState, integrationTypeId });
	}

	setSelectedIntegrationFilter(filter: string) {
		this._selectedIntegrationFilter$.next(filter);
		const filterState = this._filters$.getValue();
		this._filters$.next({ ...filterState, filter });
	}

	searchIntegration(searchQuery: string) {
		const filterState = this._filters$.getValue();
		this._filters$.next({ ...filterState, searchQuery });
	}

	/*
	 * Clear integration store filters
	 */
	clearFilters() {
		this.setSelectedIntegrationFilter(InitialFilter.filter);

		const integrationGroups = this._integrationGroups$.getValue();
		const integrationType = this._mapToDefaultType(integrationGroups);
		this.setSelectedIntegrationTypeId(integrationType.id);

		this.searchIntegration(InitialFilter.searchQuery);
	}
}
