import { Injectable } from '@angular/core';
import {
	IIntegrationViewModel,
	IIntegrationFilter,
	IntegrationTypeNameEnum,
	IntegrationTypeGroupEnum
} from '@gauzy/models';
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

const initialFIlter: IIntegrationFilter = {
	integrationTypeId: '',
	searchQuery: ''
};

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

	private _selectedIntegrationTypeId$: BehaviorSubject<
		string
	> = new BehaviorSubject('');
	public selectedIntegrationTypeId$: Observable<
		string
	> = this._selectedIntegrationTypeId$.asObservable();
	private _filters$: BehaviorSubject<
		IIntegrationFilter
	> = new BehaviorSubject(initialFIlter);

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
				distinctUntilChanged(),
				debounceTime(300),
				mergeMap(({ integrationTypeId, searchQuery }) => {
					return integrationTypeId
						? this._integrationsService.fetchIntegrations(
								integrationTypeId,
								searchQuery
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
				})
			)
			.subscribe();
	}

	private _loadIntegrationGroups() {
		this._integrationsService
			.fetchIntegrationGroups()
			.pipe(
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
						searchQuery: ''
					})
				),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return of([]);
				}),
				finalize(() => this._isLoading$.next(false))
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
		const filterState = this._filters$.getValue();
		this._filters$.next({ ...filterState, integrationTypeId });
	}

	searchIntegration(searchQuery: string) {
		const filterState = this._filters$.getValue();
		this._filters$.next({ ...filterState, searchQuery });
	}
}
