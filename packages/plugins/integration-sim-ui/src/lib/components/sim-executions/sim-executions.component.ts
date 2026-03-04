import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap, switchMap } from 'rxjs';
import { SimService, SimStoreService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-sim-executions',
	templateUrl: './sim-executions.component.html',
	styleUrls: ['./sim-executions.component.scss'],
	standalone: false
})
export class SimExecutionsComponent extends TranslationBaseComponent implements OnInit {
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly _simService = inject(SimService);
	private readonly _simStoreService = inject(SimStoreService);

	readonly loading = signal<boolean>(false);
	readonly executions = signal<any[]>([]);
	readonly total = signal<number>(0);
	readonly currentPage = signal<number>(1);

	integrationId: string = '';
	filterWorkflowId: string = '';
	filterStatus: string = '';
	readonly pageSize = 20;

	readonly statusOptions = ['', 'queued', 'processing', 'completed', 'failed'];

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this._simStoreService.selectedIntegrationId$
			.pipe(
				filter((id): id is string => !!id),
				tap((id) => {
					this.integrationId = id;
					this.loadExecutions();
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Fallback: read from parent route params
		if (!this.integrationId) {
			this._activatedRoute.parent?.params
				.pipe(
					filter((params) => !!params['id']),
					tap((params) => {
						this.integrationId = params['id'];
						this._simStoreService.setSelectedIntegrationId(this.integrationId);
						this.loadExecutions();
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	loadExecutions(): void {
		this.loading.set(true);
		const offset = (this.currentPage() - 1) * this.pageSize;

		this._simService
			.getExecutionHistory({
				workflowId: this.filterWorkflowId || undefined,
				status: this.filterStatus || undefined,
				limit: this.pageSize,
				offset
			})
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (result) => {
					this.executions.set(result.data);
					this.total.set(result.total);
					this._simStoreService.setExecutions(result.data);
					this.loading.set(false);
				},
				error: () => {
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

	get totalPages(): number {
		return Math.ceil(this.total() / this.pageSize);
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
			default:
				return 'basic';
		}
	}

	formatDuration(ms?: number): string {
		if (!ms) return '-';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}
}
