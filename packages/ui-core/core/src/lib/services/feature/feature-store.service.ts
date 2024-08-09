import { Injectable } from '@angular/core';
import {
	IFeature,
	IFeatureOrganization,
	IFeatureOrganizationUpdateInput,
	IFeatureOrganizationFindInput,
	IPagination
} from '@gauzy/contracts';
import { BehaviorSubject, EMPTY, from, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as _ from 'underscore';
import { FeatureService } from './feature.service';

@Injectable()
export class FeatureStoreService {
	private _features$: BehaviorSubject<IFeature[]> = new BehaviorSubject([]);
	public features$: Observable<IFeature[]> = this._features$.asObservable();

	private _blocks$: BehaviorSubject<IFeature[][]> = new BehaviorSubject([]);
	public blocks$: Observable<IFeature[][]> = this._blocks$.asObservable();

	private _featureOrganizations$: BehaviorSubject<
		IFeatureOrganization[]
	> = new BehaviorSubject([]);
	public featureOrganizations$: Observable<
		IFeatureOrganization[]
	> = this._featureOrganizations$.asObservable();

	private _featureToggles$: BehaviorSubject<any> = new BehaviorSubject([]);
	public featureToggles$: Observable<any> = this._featureToggles$.asObservable();

	constructor(
		private readonly _featureService: FeatureService
	) {}

	public loadUnleashFeatures() {
		const promise = this._featureService.getFeatureToggleDefinition();
		const observable = from(promise);
		return observable.pipe(
			tap((items) => {
				this._featureToggles$.next(items);
			})
		);
	}

	public loadFeatures(
		relations?: string[]
	): Observable<IPagination<IFeature>> {
		const features$ = this._features$.getValue();
		if (features$.length > 0) {
			return EMPTY;
		}

		return this._featureService.getParentFeatures(relations).pipe(
			tap(({ items }) => {
				this._features$.next(items);
				this._blocks$.next(_.chunk(items, 2) as Array<IFeature[]>);
			})
		);
	}

	public loadFeatureOrganizations(
		relations?: string[],
		findInput?: IFeatureOrganizationFindInput
	): Observable<IPagination<IFeatureOrganization>> {
		return this._featureService
			.getFeatureOrganizations(findInput, relations)
			.pipe(tap(({ items }) => this._featureOrganizations$.next(items)));
	}

	changedFeature(payload: IFeatureOrganizationUpdateInput) {
		return this._featureService.featureToggle(payload);
	}
}
