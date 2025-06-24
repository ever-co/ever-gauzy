import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ID } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, distinctUntilChanged, filter, map, Observable, take, tap } from 'rxjs';
import { CamshotAction } from '../../+state/camshot/camshot.action';
import { CamshotQuery } from '../../+state/camshot/camshot.query';
import { CamshotStore } from '../../+state/camshot/camshot.store';
import { ICamshot } from '../../shared/models/camshot.model';
import { NbDialogService } from '@nebular/theme';
import { AlertModalComponent } from '@gauzy/ui-core/shared';
import { CamshotViewerComponent } from '../../shared/ui/camshot/camshot-viewer/camshot-viewer.component';

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
		private readonly dialogService: NbDialogService,
		private readonly actions: Actions
	) { }

	ngOnChanges(changes: SimpleChanges): void {
		if (changes?.timeSlotId) {
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

	public onView(camshot: ICamshot) {
		this.dialogService.open(CamshotViewerComponent, {
			context: {
				imageUrl: camshot.fullUrl,
				imageTitle: camshot.title,
				imageDescription: camshot.uploadedBy?.fullName || 'N/A'
			},
			hasBackdrop: true
		});
	}

	public onDownload(camshot: ICamshot) {
		this.actions.dispatch(CamshotAction.downloadCamshot(camshot.fullUrl));
	}

	public onRecover(camshot: ICamshot) {
		this.actions.dispatch(CamshotAction.restoreCamshot(camshot.id));
	}

	public onHardDelete(camshot: ICamshot) {
		this.dialogService
			.open(AlertModalComponent, {
				context: {
					data: {
						message: 'Are you sure you want to delete this camshot definitely?',
						title: 'Delete Camshot Forever'
					}
				},
				hasBackdrop: true
			})
			.onClose.pipe(
				take(1),
				filter((confirm: 'yes' | 'no') => confirm === 'yes'),
				tap(() => this.actions.dispatch(CamshotAction.hardDeleteCamshot(camshot.id, { forceDelete: true })))
			)
			.subscribe();
	}

	public onDelete({ id }: ICamshot) {
		this.dialogService
			.open(AlertModalComponent, {
				context: {
					data: {
						message: 'Are you sure you want to delete this camshot?',
						title: 'Delete Camshot'
					}
				},
				hasBackdrop: true
			})
			.onClose.pipe(
				take(1),
				filter((confirm: 'yes' | 'no') => confirm === 'yes'),
				tap(() => this.actions.dispatch(CamshotAction.deleteCamshot(id)))
			)
			.subscribe();
	}

	public fetchCamshots(): void {
		if (!this.timeSlotId) {
			return;
		}
		this.actions.dispatch(
			CamshotAction.fetchCamshots({
				where: {
					timeSlotId: this.timeSlotId
				},
				relations: ['uploadedBy', 'uploadedBy.user'],
				skip: this.skip,
				take: this.take,
				order: { recordedAt: 'DESC' }
			})
		);
	}

	public fetchMoreCamshots(): void {
		if (this.hasNext && this.unlockInfiniteList) {
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

	public get unlockInfiniteList(): boolean {
		return this.timeSlotId && this.camshotQuery.camshots.length > 0;
	}

	public get isLoading$(): Observable<boolean> {
		return this.camshotQuery.isLoading$;
	}

	public ngOnDestroy() {
		this.reset();
	}
}
