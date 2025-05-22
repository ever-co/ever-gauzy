import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { ID, IPluginVersion } from '@gauzy/contracts';
import { NbSelectComponent } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, map, tap } from 'rxjs';
import { PluginVersionActions } from '../../+state/actions/plugin-version.action';
import { PluginVersionQuery } from '../../+state/queries/plugin-version.query';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-version-selector',
	templateUrl: './version-selector.component.html',
	styleUrls: ['./version-selector.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VersionSelectorComponent implements OnInit, OnChanges {
	@ViewChild(NbSelectComponent) select: NbSelectComponent;
	private skip = 1;
	private hasNext = false;
	private readonly take = 10;
	@Input()
	public pluginId: ID = null;

	constructor(private readonly action: Actions, public readonly query: PluginVersionQuery) {}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['pluginId']) {
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
		if (!this.pluginId) {
			return;
		}
		this.action.dispatch(
			PluginVersionActions.getAll(this.pluginId, {
				skip: this.skip,
				take: this.take,
				relations: ['plugin', 'sources'],
				order: { releaseDate: 'DESC' },
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

	public async onVersionChange(id: IPluginVersion['id']): Promise<void> {
		const version = this.query.versions.find((version) => version.id === id);
		this.action.dispatch(PluginVersionActions.selectVersion(version));
	}

	public get unlockInfiniteList(): boolean {
		return this.pluginId && this.query.versions.length > 0;
	}

	public reset(): void {
		this.skip = 1;
		this.hasNext = false;
		this.action.dispatch(PluginVersionActions.reset());
	}
}
