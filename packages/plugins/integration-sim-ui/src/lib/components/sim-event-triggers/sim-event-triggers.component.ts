import { Component, OnInit, signal, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, filter, tap, finalize, forkJoin, switchMap } from 'rxjs';
import { SimService, SimStoreService, ISimSupportedEvent, ISimEventMapping, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-sim-event-triggers',
	templateUrl: './sim-event-triggers.component.html',
	styleUrls: ['./sim-event-triggers.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimEventTriggersComponent extends TranslationBaseComponent implements OnInit {
	private readonly _simService = inject(SimService);
	private readonly _simStoreService = inject(SimStoreService);
	private readonly _toastrService = inject(ToastrService);

	readonly loading = signal<boolean>(false);
	readonly saving = signal<boolean>(false);
	readonly removing = signal<string | null>(null);

	readonly supportedEvents = signal<ISimSupportedEvent[]>([]);
	readonly eventMappings = signal<ISimEventMapping[]>([]);

	readonly integrationId = signal<string>('');

	// Form for adding a new event mapping
	mappingForm = new FormGroup({
		event: new FormControl('', [Validators.required]),
		workflowId: new FormControl('', [Validators.required, Validators.pattern(/\S+/)])
	});

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this._simStoreService.selectedIntegrationId$
			.pipe(
				filter((id): id is string => !!id),
				tap((id) => {
					this.integrationId.set(id);
					this.loading.set(true);
				}),
				switchMap(() =>
					forkJoin({
						supported: this._simService.getSupportedEvents(),
						mappings: this._simService.getEventMappings()
					}).pipe(
						catchError(() => {
							this._toastrService.error(
								this.getTranslation('INTEGRATIONS.SIM_PAGE.EVENT_TRIGGERS.LOAD_FAILED')
							);
							return EMPTY;
						}),
						finalize(() => this.loading.set(false))
					)
				),
				untilDestroyed(this)
			)
			.subscribe({
				next: ({ supported, mappings }) => {
					this.supportedEvents.set(supported);
					this.eventMappings.set(mappings);
				}
			});
	}

	/**
	 * Available events that are not yet mapped.
	 */
	readonly availableEvents = computed(() => {
		const mappedEventNames = new Set(this.eventMappings().map((m) => m.event));
		return this.supportedEvents().filter((e) => !mappedEventNames.has(e.event));
	});

	/**
	 * Get the description for a given event name.
	 */
	getEventDescription(eventName: string): string {
		return this.supportedEvents().find((e) => e.event === eventName)?.description || eventName;
	}

	/**
	 * Save a new event-to-workflow mapping.
	 */
	saveMapping(): void {
		if (this.mappingForm.invalid || this.saving()) return;

		this.saving.set(true);

		const event = this.mappingForm.get('event')!.value!;
		const workflowId = this.mappingForm.get('workflowId')!.value!.trim();

		this._simService
			.setEventMapping(event, workflowId)
			.pipe(
				finalize(() => this.saving.set(false)),
				untilDestroyed(this)
			)
			.subscribe({
				next: () => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.SIM_PAGE.EVENT_TRIGGERS.MAPPING_SAVED')
					);
					this.mappingForm.reset({ event: '', workflowId: '' });
					this._loadData();
				},
				error: (err) => {
					this._toastrService.error(
						err?.error?.message ||
							err?.message ||
							this.getTranslation('INTEGRATIONS.SIM_PAGE.EVENT_TRIGGERS.SAVE_FAILED')
					);
				}
			});
	}

	/**
	 * Remove an event-to-workflow mapping.
	 */
	removeMapping(event: string): void {
		if (this.removing()) return;

		this.removing.set(event);

		this._simService
			.removeEventMapping(event)
			.pipe(
				finalize(() => this.removing.set(null)),
				untilDestroyed(this)
			)
			.subscribe({
				next: () => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.SIM_PAGE.EVENT_TRIGGERS.MAPPING_REMOVED')
					);
					this._loadData();
				},
				error: (err) => {
					this._toastrService.error(
						err?.error?.message ||
							err?.message ||
							this.getTranslation('INTEGRATIONS.SIM_PAGE.EVENT_TRIGGERS.REMOVE_FAILED')
					);
				}
			});
	}

	/**
	 * Load supported events and current mappings.
	 */
	private _loadData(): void {
		this.loading.set(true);

		forkJoin({
			supported: this._simService.getSupportedEvents(),
			mappings: this._simService.getEventMappings()
		})
			.pipe(
				finalize(() => this.loading.set(false)),
				untilDestroyed(this)
			)
			.subscribe({
				next: ({ supported, mappings }) => {
					this.supportedEvents.set(supported);
					this.eventMappings.set(mappings);
				},
				error: () => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.SIM_PAGE.EVENT_TRIGGERS.LOAD_FAILED')
					);
				}
			});
	}
}
