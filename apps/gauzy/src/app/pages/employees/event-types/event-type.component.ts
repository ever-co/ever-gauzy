import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EventType } from '@gauzy/models';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { EventTypeMutationComponent } from './event-type-mutation/event-type-mutation.component';

@Component({
	templateUrl: './event-type.component.html'
})
export class EventTypeComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedEventType: EventType;

	@ViewChild('eventTypesTable', { static: false }) eventTypesTable;

	loading = true;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private store: Store,
		private dialogService: NbDialogService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.sourceSmartTable.load([
			{
				eventName: 'Event 1',
				eventDuration: 'Duration 1',
				eventDescription: 'Description 1',
				eventConfiguration: 'Configuration'
			},
			{
				eventName: 'Event 1',
				eventDuration: 'Duration 1',
				eventDescription: 'Description 1',
				eventConfiguration: 'Configuration'
			},
			{
				eventName: 'Event 1',
				eventDuration: 'Duration 1',
				eventDescription: 'Description 1',
				eventConfiguration: 'Configuration'
			}
		]);
		this.loading = false;

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.openAddEventTypeDialog();
				}
			});
	}

	openAddEventTypeDialog() {
		this.dialogService
			.open(EventTypeMutationComponent)
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				console.log('form:::', formData);
			});
	}

	openEditEventTypeDialog() {
		this.dialogService
			.open(EventTypeMutationComponent, {
				context: {
					eventType: this.selectedEventType
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (formData) => {
				console.log('form:::', formData);
			});
	}

	selectEventType(ev: {
		data: EventType;
		isSelected: Boolean;
		selected: EventType[];
		source: LocalDataSource;
	}) {
		if (ev.isSelected) {
			this.selectedEventType = ev.data;
		} else {
			this.selectedEventType = null;
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadSmartTableSettings();
			});
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				eventName: {
					title: this.getTranslation('EVENT_TYPE_PAGE.EVENT_NAME'),
					type: 'text',
					class: 'align-row'
				},
				eventDuration: {
					title: this.getTranslation(
						'EVENT_TYPE_PAGE.EVENT_DURATION'
					),
					type: 'text',
					class: 'align-row'
				},
				eventDescription: {
					title: this.getTranslation(
						'EVENT_TYPE_PAGE.EVENT_DESCRIPTION'
					),
					type: 'text',
					class: 'align-row'
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
