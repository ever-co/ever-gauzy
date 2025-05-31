import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { ID, IPluginSource } from '@gauzy/contracts';
import { NbSelectComponent } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, map, tap } from 'rxjs';
import { PluginSourceActions } from '../../+state/actions/plugin-source.action';
import { PluginSourceQuery } from '../../+state/queries/plugin-source.query';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-source-selector',
	templateUrl: './source-selector.component.html',
	styleUrls: ['./source-selector.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SourceSelectorComponent implements OnInit, OnChanges {
	@ViewChild(NbSelectComponent) select: NbSelectComponent;
	private skip = 1;
	private hasNext = false;
	private readonly take = 10;
	@Input()
	public pluginId: ID = null;
	@Input()
	public versionId: ID = null;

	constructor(private readonly action: Actions, public readonly query: PluginSourceQuery) {}

	public ngOnChanges(changes: SimpleChanges): void {
		if (changes['versionId'] || changes['pluginId']) {
			this.reset();
			this.load();
		}
	}

	ngOnInit(): void {
		this.query
			.select()
			.pipe(
				map(({ count }) => count > this.skip * this.take),
				distinctUntilChanged(),
				tap((hasNext) => (this.hasNext = hasNext)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public load(): void {
		if (!this.pluginId || !this.versionId) {
			return;
		}
		this.action.dispatch(
			PluginSourceActions.getAll(this.pluginId, this.versionId, {
				skip: this.skip,
				take: this.take,
				order: { createdAt: 'DESC' },
				withDeleted: false
			})
		);
	}

	public loadMore(): void {
		if (this.hasNext && this.unlockInfiniteList) {
			this.skip++;
			this.load();
		}
	}

	public async onSourceChange(id: IPluginSource['id']): Promise<void> {
		const source = this.query.sources.find((source) => source.id === id);
		this.action.dispatch(PluginSourceActions.selectSource(source));
	}

	public get unlockInfiniteList(): boolean {
		return this.pluginId && this.query.sources.length > 0;
	}

	public reset() {
		this.skip = 1;
		this.hasNext = false;
		this.action.dispatch(PluginSourceActions.reset());
	}
}
