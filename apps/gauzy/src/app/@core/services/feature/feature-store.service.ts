import { Injectable } from '@angular/core';
import {
	IFeature,
	IFeatureOrganization,
	IFeatureOrganizationCreateInput,
	IFeatureOrganizationFindInput
} from '@gauzy/models';
import { BehaviorSubject, EMPTY, Observable } from 'rxjs';
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

	constructor(private _featureService: FeatureService) {}

	public loadFeatures(
		relations?: string[]
	): Observable<{ items: IFeature[]; total: number }> {
		const features$ = this._features$.getValue();
		if (features$.length > 0) {
			return EMPTY;
		}

		return this._featureService.getFeatures(relations).pipe(
			tap(({ items }) => {
				this._features$.next(items);
				this._blocks$.next(_.chunk(items, 2) as Array<IFeature[]>);
			})
		);
	}

	public loadFeatureOrganizations(
		relations?: string[],
		findInput?: IFeatureOrganizationFindInput
	): Observable<IFeatureOrganization[]> {
		return this._featureService
			.getFeatureOrganizations(findInput, relations)
			.pipe(tap((items) => this._featureOrganizations$.next(items)));
	}

	changedFeature(payload: IFeatureOrganizationCreateInput) {
		return this._featureService.featureAction(payload);
	}
}
