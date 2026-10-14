import { ChangeDetectionStrategy, Component, Injector, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { BaseEntityEnum, IOrganization } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { IRecordViewSection } from './record-view.model';
import { RecordViewPageState, recordViewPageStateOf } from './record-view-page.component';

/**
 * What a record's full-width page needs to know, given as the route's `data.recordView`
 * (see {@link RECORD_VIEW_ROUTE_DATA_KEY}). The functions run with the page's injector, so a feature
 * module states its own service calls and the record's sections — usually the very builder its
 * right-side drawer uses — and gets the page, its states and its URL for free.
 */
/** The organization the page belongs to: the one selected in the header. */
export interface IRecordViewScope {
	organizationId: string;
	tenantId: string;
}

export interface IRecordViewRouteData<T = any> {
	/** i18n key for the page heading, e.g. `EXPENSES_PAGE.HEADER`. */
	heading: string;
	/** The list the record belongs to, for the back button. */
	backLink: string;
	/**
	 * Loads the record with everything its sections read, within `scope` (pass it to list reads: several
	 * require the organization and tenant). Resolve `null` (or reject with a 404) when there is no such
	 * record the caller can see.
	 */
	load: (id: string, injector: Injector, scope: IRecordViewScope) => Promise<T | null>;
	/** The record, described for `ngx-record-view`. */
	sections: (record: T, injector: Injector) => IRecordViewSection[];
	/** Free text under the heading — the record's own name. */
	subtitle?: (record: T, injector: Injector) => string;
	/** Shows the favorite star for this record type in the page header. */
	favorite?: { entity: BaseEntityEnum; name?: (record: T) => string };
}

/** The `data` key a route states its {@link IRecordViewRouteData} under. */
export const RECORD_VIEW_ROUTE_DATA_KEY = 'recordView';

/**
 * A record's full-width page, driven by its route (`view/:id` + `data.recordView`): what the drawer's
 * "expand to full width" icon and a sidebar favorite open (handover §4.P). Bookmarkable, shareable,
 * reloadable — the record id is in the URL.
 *
 * Like the lists, the page belongs to the organization selected in the header: a record of another
 * organization reads "not found" (its favorite star would otherwise file it under the wrong one), and
 * switching the organization reloads the page, discarding any load still in flight.
 */
@UntilDestroy()
@Component({
	selector: 'ngx-record-view-route-page',
	template: `
		<ngx-record-view-page
			[heading]="config?.heading"
			[subtitle]="subtitle"
			[backLink]="config?.backLink"
			[state]="state"
			(retry)="load()"
		>
			@if (record && config?.favorite) {
				<ngx-favorite-toggle
					recordPageActions
					[entityType]="config.favorite.entity"
					[entityId]="record.id"
					[entityName]="favoriteName"
					size="small"
					status="basic"
					spacing="list"
				></ngx-favorite-toggle>
			}
			@if (record) {
				<ngx-record-view [record]="record" [sections]="sections" [placeholder]="'SM_TABLE.NONE' | translate">
				</ngx-record-view>
			}
		</ngx-record-view-page>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class RecordViewRoutePageComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly injector = inject(Injector);
	private readonly translateService = inject(TranslateService);
	private readonly store = inject(Store);

	config: IRecordViewRouteData;
	record: any = null;
	sections: IRecordViewSection[] = [];
	subtitle: string = null;
	favoriteName: string = null;
	state: RecordViewPageState = 'loading';

	private recordId: string = null;
	private scope: IRecordViewScope = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;

	ngOnInit(): void {
		const organization$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			distinctUntilChanged((a: IOrganization, b: IOrganization) => a.id === b.id)
		);
		combineLatest([this.route.data, this.route.paramMap.pipe(map((params) => params.get('id'))), organization$])
			.pipe(
				map(([data, id, organization]) => ({
					config: data?.[RECORD_VIEW_ROUTE_DATA_KEY] as IRecordViewRouteData,
					id,
					organization: organization as IOrganization
				})),
				filter(({ config, id }) => !!config && !!id),
				distinctUntilChanged(
					(a, b) => a.config === b.config && a.id === b.id && a.organization.id === b.organization.id
				),
				untilDestroyed(this)
			)
			.subscribe(({ config, id, organization }) => {
				this.config = config;
				this.recordId = id;
				this.scope = { organizationId: organization.id, tenantId: organization.tenantId };
				void this.load();
			});
		// Section labels are i18n keys, but derived values (an estimate's units, a status text) may not be.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.describe());
	}

	/** Loads (or reloads, after an error) the record the URL names. */
	async load(): Promise<void> {
		const id = this.recordId;
		const config = this.config;
		const scope = this.scope;
		if (!id || !config || !scope) {
			return;
		}
		const sequence = ++this.loadSequence;
		// Nothing of the previous record (or organization) stays on screen — not its name in the header, not
		// its star, not its sections — while this one loads or if it fails.
		this.record = null;
		this.sections = [];
		this.subtitle = null;
		this.favoriteName = null;
		this.state = 'loading';
		try {
			const record = await config.load(id, this.injector, scope);
			if (sequence !== this.loadSequence) {
				return; // a newer navigation or organization switch owns the page
			}
			// The record must be the one the URL names (a list read can widen or replace the id filter — e.g.
			// a team read scoped to the caller's own teams) and belong to the selected organization.
			if (
				!record ||
				String(record.id) !== String(id) ||
				(record.organizationId && record.organizationId !== scope.organizationId)
			) {
				throw { status: 404 };
			}
			this.record = record;
			this.describe();
			this.state = 'ready';
		} catch (error) {
			if (sequence !== this.loadSequence) {
				return;
			}
			this.record = null;
			this.state = recordViewPageStateOf(error);
		}
	}

	private describe(): void {
		if (!this.record || !this.config) {
			return;
		}
		this.sections = this.config.sections(this.record, this.injector);
		this.subtitle = this.config.subtitle?.(this.record, this.injector) ?? null;
		this.favoriteName = this.config.favorite?.name?.(this.record) ?? this.subtitle;
	}
}
