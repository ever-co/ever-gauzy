import { ChangeDetectionStrategy, Component, forwardRef, OnInit } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IOrganizationContact } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, concatMap, filter, map, Observable, tap } from 'rxjs';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { AbstractSelectorComponent } from '../../components/abstract/selector.abstract';
import { SelectorElectronService } from '../../services/selector-electron.service';
import { ProjectSelectorService } from '../project-selector/+state/project-selector.service';
import { ClientSelectorQuery } from './+state/client-selector.query';
import { ClientSelectorService } from './+state/client-selector.service';
import { ClientSelectorStore } from './+state/client-selector.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-client-selector',
	templateUrl: './client-selector.component.html',
	styleUrls: ['./client-selector.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ClientSelectorComponent),
			multi: true
		}
	]
})
export class ClientSelectorComponent extends AbstractSelectorComponent<IOrganizationContact> implements OnInit {
	constructor(
		private readonly selectorElectronService: SelectorElectronService,
		public readonly clientSelectorStore: ClientSelectorStore,
		public readonly clientSelectorQuery: ClientSelectorQuery,
		private readonly clientSelectorService: ClientSelectorService,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly timeTrackerQuery: TimeTrackerQuery
	) {
		super();
	}

	public ngOnInit(): void {
		this.clientSelectorService.onScroll$.pipe(untilDestroyed(this)).subscribe();
		this.clientSelectorQuery.selected$
			.pipe(
				filter(Boolean),
				tap(() => this.projectSelectorService.resetPage()),
				concatMap(() => this.projectSelectorService.load()),
				untilDestroyed(this)
			)
			.subscribe();
		// Handle search logic
		this.handleSearch(this.clientSelectorService);
	}

	public clear(): void {
		if (this.useStore) {
			this.selectorElectronService.update({ organizationContactId: null });
			this.selectorElectronService.refresh();
		}
	}

	public addContact = async (name: IOrganizationContact['name']) => {
		return this.clientSelectorService.addContact(name);
	};

	public get error$(): Observable<string> {
		return this.clientSelectorQuery.selectError();
	}

	public get selected$(): Observable<IOrganizationContact> {
		return this.clientSelectorQuery.selected$;
	}

	public get data$(): Observable<IOrganizationContact[]> {
		return this.clientSelectorQuery.data$;
	}

	protected updateSelected(value: IOrganizationContact['id']): void {
		// Update store only if useStore is true
		if (this.useStore) {
			this.selectorElectronService.update({ organizationContactId: value });
			this.clientSelectorStore.updateSelected(value);
		}
	}

	public get isLoading$(): Observable<boolean> {
		return this.clientSelectorQuery.selectLoading();
	}

	public get disabled$(): Observable<boolean> {
		return combineLatest([this.timeTrackerQuery.disabled$, this.isDisabled$.asObservable()]).pipe(
			map(([disabled, selectorDisabled]) => disabled || selectorDisabled)
		);
	}

	public get hasPermission$(): Observable<boolean> {
		return this.clientSelectorService.hasPermission$;
	}

	public onShowMore(): void {
		this.clientSelectorService.onScrollToEnd();
	}
}
