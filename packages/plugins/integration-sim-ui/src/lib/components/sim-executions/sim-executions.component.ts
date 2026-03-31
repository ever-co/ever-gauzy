import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap, switchMap, of } from 'rxjs';
import { SimService, SimStoreService, ISimExecutionRecord, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-sim-executions',
	templateUrl: './sim-executions.component.html',
	styleUrls: ['./sim-executions.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimExecutionsComponent extends TranslationBaseComponent implements OnInit {
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly _simService = inject(SimService);
	private readonly _simStoreService = inject(SimStoreService);
	private readonly _toastrService = inject(ToastrService);

	private _loadSeq = 0;

	readonly loading = signal<boolean>(false);
	readonly executions = signal<ISimExecutionRecord[]>([]);
	readonly total = signal<number>(0);
	readonly currentPage = signal<number>(1);

	readonly filterWorkflowId = signal<string>('');
	readonly filterStatus = signal<string>('');
	readonly pageSize = 20;

	readonly statusOptions = ['', 'queued', 'processing', 'completed', 'failed', 'cancelled'];

	readonly totalPages = computed(() => (this.pageSize > 0 ? Math.ceil(this.total() / this.pageSize) : 0));

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		// Use store as primary source, fallback to route params
		this._simStoreService.selectedIntegrationId$
			.pipe(
				switchMap((id) => {
					if (id) return of(id);
					// Fallback: read from parent route params
					return this._activatedRoute.parent?.params.pipe(
						filter((params) => !!params['id']),
						tap((params) => this._simStoreService.setSelectedIntegrationId(params['id'])),
						switchMap((params) => of(params['id']))
					) ?? of(null);
				}),
				filter((id): id is string => !!id),
				tap(() => {
					this.loadExecutions();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	loadExecutions(): void {
		const seq = ++this._loadSeq;
		this.loading.set(true);
		const offset = (this.currentPage() - 1) * this.pageSize;

		this._simService
			.getExecutionHistory({
				workflowId: this.filterWorkflowId() || undefined,
				status: this.filterStatus() || undefined,
				limit: this.pageSize,
				offset
			})
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (result) => {
					if (seq !== this._loadSeq) return; // Discard stale response
					this.executions.set(result.data ?? []);
					this.total.set(result.total ?? 0);
					this._simStoreService.setExecutions(result.data ?? []);
					this.loading.set(false);
				},
				error: (error) => {
					if (seq !== this._loadSeq) return;
					this.executions.set([]);
					this.total.set(0);
					this._toastrService.danger(error, 'TOASTR.TITLE.ERROR');
					this.loading.set(false);
				}
			});
	}

	onFilterChange(): void {
		this.currentPage.set(1);
		this.loadExecutions();
	}

	onPageChange(page: number): void {
		this.currentPage.set(page);
		this.loadExecutions();
	}

	getStatusClass(status: string): string {
		switch (status) {
			case 'completed':
				return 'success';
			case 'failed':
				return 'danger';
			case 'processing':
				return 'warning';
			case 'queued':
				return 'info';
			case 'cancelled':
				return 'basic';
			default:
				return 'basic';
		}
	}

	formatDuration(ms?: number | null): string {
		if (ms == null) return '-';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}
}
