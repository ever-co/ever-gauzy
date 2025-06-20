import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ID } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, distinctUntilChanged, filter, map, Observable, take, tap } from 'rxjs';
import { SoundshotAction } from '../../+state/soundshot/soundshot.action';
import { SoundshotQuery } from '../../+state/soundshot/soundshot.query';
import { SoundshotStore } from '../../+state/soundshot/soundshot.store';
import { ISoundshot } from '../../shared/models/soundshot.model';
import { AlertModalComponent } from '@gauzy/ui-core/shared';
import { NbDialogService } from '@nebular/theme';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'plug-soundshot-list',
	standalone: false,
	templateUrl: './soundshot-list.component.html',
	styleUrl: './soundshot-list.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoundshotListComponent implements OnInit, OnChanges, OnDestroy {
	@Input()
	public timeSlotId: ID;
	private skip = 1;
	private hasNext = false;
	private readonly take = 10;

	constructor(
		private readonly soundshotQuery: SoundshotQuery,
		private readonly soundshotStore: SoundshotStore,
		private readonly dialogService: NbDialogService,
		private readonly actions: Actions
	) { }

	ngOnInit() {
		this.soundshotQuery
			.select()
			.pipe(
				map(({ count }) => count > this.skip * this.take),
				distinctUntilChanged(),
				tap((hasNext) => (this.hasNext = hasNext)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes?.timeSlotId) {
			this.reset();
			this.fetchSoundshots();
		}
	}

	public onDownload(soundshot: ISoundshot) {
		this.actions.dispatch(SoundshotAction.download(soundshot.fullUrl));
	}

	public onRecover(soundshot: ISoundshot) {
		this.actions.dispatch(SoundshotAction.restore(soundshot.id));
	}

	public onHardDelete(soundshot: ISoundshot) {
		this.dialogService
			.open(AlertModalComponent, {
				context: {
					data: {
						message: 'Are you sure you want to delete this soundshot definitely?',
						title: 'Delete Soundshot Forever'
					}
				},
				hasBackdrop: true
			})
			.onClose.pipe(
				take(1),
				filter((confirm: 'yes' | 'no') => confirm === 'yes'),
				tap(() => this.actions.dispatch(SoundshotAction.hardDelete(soundshot.id, { forceDelete: true })))
			)
			.subscribe();
	}

	public onDelete({ id }: ISoundshot) {
		this.dialogService
			.open(AlertModalComponent, {
				context: {
					data: {
						message: 'Are you sure you want to delete this soundshot?',
						title: 'Delete Soundshot'
					}
				},
				hasBackdrop: true
			})
			.onClose.pipe(
				take(1),
				filter((confirm: 'yes' | 'no') => confirm === 'yes'),
				tap(() => this.actions.dispatch(SoundshotAction.delete(id)))
			)
			.subscribe();
	}

	public fetchSoundshots(): void {
		if (!this.timeSlotId) {
			return;
		}
		this.actions.dispatch(
			SoundshotAction.fetchAll({
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

	public fetchMoreSoundshots(): void {
		if (this.hasNext && this.unlockInfiniteList) {
			this.skip++;
			this.fetchSoundshots();
		}
	}

	public reset(): void {
		this.skip = 1;
		this.hasNext = false;
		this.soundshotStore.update({ soundshots: [] });
	}

	public get soundshots$(): Observable<ISoundshot[]> {
		return this.soundshotQuery.soundshots$;
	}

	public get isAvailable$(): Observable<boolean> {
		return combineLatest([this.soundshotQuery.isAvailable$, this.isLoading$]).pipe(
			map(([isAvailable, isLoading]) => isAvailable && !isLoading)
		);
	}

	public get unlockInfiniteList(): boolean {
		return this.timeSlotId && this.soundshotQuery.soundshots.length > 0;
	}

	public get isLoading$(): Observable<boolean> {
		return this.soundshotQuery.isLoading$;
	}

	public ngOnDestroy() {
		this.reset();
	}
}
