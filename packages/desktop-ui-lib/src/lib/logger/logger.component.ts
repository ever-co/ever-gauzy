import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	OnDestroy,
	signal,
	computed,
	inject,
	viewChild,
	ElementRef
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import {
	NbCardModule,
	NbSelectModule,
	NbOptionModule,
	NbIconModule,
	NbButtonModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbCheckboxModule,
	NbLayoutModule
} from '@nebular/theme';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { ILogItems, TLogLevel } from '@gauzy/contracts';

@Component({
	selector: 'audit-trail-logger',
	templateUrl: './logger.component.html',
	styleUrls: ['./logger.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NbCardModule,
		NbSelectModule,
		NbOptionModule,
		NbIconModule,
		NbButtonModule,
		NbSpinnerModule,
		NbTooltipModule,
		NbCheckboxModule,
		DatePipe,
		UpperCasePipe,
		NbLayoutModule
	]
})
export class AuditTrailLoggerComponent implements OnInit, OnDestroy {
	private readonly loggerService = inject(LoggerService);
	private readonly destroy$ = new Subject<void>();

	readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

	readonly isLoading = signal(false);
	readonly isLoadingMore = signal(false);
	readonly logLevelFilter = signal<string>('all');
	readonly serviceNameFilter = signal<string>('all');
	readonly pageSize = signal<number>(200);
	readonly currentPage = signal(0);
	readonly hasMore = signal(true);
	readonly allItems = signal<ILogItems[]>([]);
	/** When true, each new IPC log entry auto-scrolls the viewport to the bottom. */
	readonly isFollowing = signal(true);

	readonly serviceNames = computed(() =>
		[...new Set(this.allItems().map((i) => i.serviceName))]
	);

	readonly filteredLogs = computed(() => {
		const level = this.logLevelFilter();
		const service = this.serviceNameFilter();
		return this.allItems().filter(
			(item) =>
				(level === 'all' || item.logLevel === level) &&
				(service === 'all' || item.serviceName === service)
		);
	});

	ngOnInit(): void {
		console.log('LoggerComponent initialized');
		this.loggerService.logsStream$.pipe(takeUntil(this.destroy$)).subscribe((items) => {
			if (!items) return;

			const el = this.scrollContainer()?.nativeElement;
			const prevScrollHeight = el?.scrollHeight ?? 0;

			this.allItems.set(items);

			requestAnimationFrame(() => {
				if (!el) return;
				if (this.isFollowing() && !this.isLoadingMore()) {
					// Follow mode: always pin to the newest entry
					el.scrollTop = el.scrollHeight;
				} else if (this.isLoadingMore()) {
					// Loading older entries: keep the viewport anchored so content doesn't jump
					el.scrollTop = el.scrollHeight - prevScrollHeight;
				}
			});
		});


		this.loadEntries(true);
	}

	toggleFollow(): void {
		const next = !this.isFollowing();
		this.isFollowing.set(next);
		// If the user re-enables following, jump to bottom immediately
		if (next) {
			const el = this.scrollContainer()?.nativeElement;
			if (el) el.scrollTop = el.scrollHeight;
		}
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	onLevelChange(level: string): void {
		this.logLevelFilter.set(level);
		this.loadEntries(true);
	}

	onServiceChange(service: string): void {
		this.serviceNameFilter.set(service);
		this.loadEntries(true);
	}

	onPageSizeChange(size: number): void {
		this.pageSize.set(size);
		this.loadOlderEntries();
	}

	async loadEntries(initial = false): Promise<void> {
		this.isLoading.set(true);
		if (initial) {
			this.currentPage.set(0);
			this.hasMore.set(true);
		}
		const result = await this.loggerService.refreshLogs(
			this.logLevelFilter(),
			this.serviceNameFilter(),
			0,
			this.pageSize()
		);
		this.hasMore.set(result.length >= this.pageSize());
		this.isLoading.set(false);
	}

	onScroll(event: Event): void {
		const el = event.target as HTMLElement;
		if (el.scrollTop <= 20 && !this.isLoadingMore() && this.hasMore() && !this.isLoading()) {
			this.loadOlderEntries();
		}
	}

	async loadOlderEntries(): Promise<void> {
		const el = this.scrollContainer()?.nativeElement;
		const prevScrollHeight = el?.scrollHeight ?? 0;

		this.isLoadingMore.set(true);
		this.currentPage.update((p) => p + 1);

		const result = await this.loggerService.nextPage(
			this.logLevelFilter(),
			this.serviceNameFilter(),
			this.currentPage(),
			this.pageSize()
		);

		this.hasMore.set(result.length >= this.pageSize());

		requestAnimationFrame(() => {
			if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
		});

		this.isLoadingMore.set(false);
	}

	getLevelClass(level?: TLogLevel): string {
		const map: Record<string, string> = {
			info: 'level-info',
			warn: 'level-warn',
			error: 'level-error'
		};
		return map[level ?? ''] ?? 'level-info';
	}
}
