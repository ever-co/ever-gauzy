import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ID } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, distinctUntilChanged, map, Observable, tap } from 'rxjs';
import { CamshotAction } from '../../+state/camshot/camshot.action';
import { CamshotQuery } from '../../+state/camshot/camshot.query';
import { CamshotStore } from '../../+state/camshot/camshot.store';
import { ICamshot } from '../../shared/models/camshot.model';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'plug-camshot-list',
	templateUrl: './camshot-list.component.html',
	styleUrl: './camshot-list.component.scss',
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CamshotListComponent implements OnInit, OnChanges, OnDestroy {
	@Input()
	public timeSlotId: ID;
	private skip = 1;
	private hasNext = false;
	private readonly take = 10;

	constructor(
		private readonly camshotQuery: CamshotQuery,
		private readonly camshotStore: CamshotStore,
		private readonly actions: Actions
	) {}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes?.timeSlotId) {
			console.log(changes);
			this.reset();
			this.fetchCamshots();
		}
	}

	ngOnInit() {
		this.camshotQuery
			.select()
			.pipe(
				map(({ count }) => count > this.skip * this.take),
				distinctUntilChanged(),
				tap((hasNext) => (this.hasNext = hasNext)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public fetchCamshots(): void {
		this.actions.dispatch(
			CamshotAction.fetchCamshots({
				where: {
					timeSlotId: this.timeSlotId
				},
				skip: this.skip,
				take: this.take,
				order: { recordedAt: 'DESC' }
			})
		);
	}

	public fetchMoreCamshots(): void {
		if (this.hasNext) {
			this.skip++;
			this.fetchCamshots();
		}
	}

	public reset(): void {
		this.skip = 1;
		this.hasNext = false;
		this.camshotStore.update({ camshots: [] });
	}

	public get camshots$(): Observable<ICamshot[]> {
		return this.camshotQuery.camshots$;
	}

	public get isAvailable$(): Observable<boolean> {
		return combineLatest([this.camshotQuery.isAvailable$, this.isLoading$]).pipe(
			map(([isAvailable, isLoading]) => isAvailable && !isLoading)
		);
	}

	public get isLoading$(): Observable<boolean> {
		return this.camshotQuery.isLoading$;
	}

	public ngOnDestroy() {
		this.reset();
	}
}
