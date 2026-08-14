import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	Injector,
	Type,
	booleanAttribute,
	computed,
	effect,
	inject,
	input,
	isDevMode,
	output,
	reflectComponentType,
	runInInjectionContext,
	signal,
	viewChild
} from '@angular/core';
import { ResolveFn } from '@angular/router';
import { NbButtonModule, NbCardModule, NbIconModule, NbPopoverDirective, NbPopoverModule } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, from, isObservable, of } from 'rxjs';
import { map, shareReplay, take } from 'rxjs/operators';
import { ID, IDashboardWidgetPlacement, PermissionsEnum } from '@gauzy/contracts';
import {
	DASHBOARD_GRID_COLUMNS,
	DASHBOARD_WIDGET_CONFIG,
	DASHBOARD_WIDGET_CONTEXT,
	DashboardContextService,
	IDashboardWidgetContext,
	IDashboardWidgetContextOverrides,
	narrowDashboardContext,
	Store,
	WidgetConfigField,
	WidgetRegistryConfig,
	WidgetRegistryService
} from '@gauzy/ui-core/core';
import { toErrorMessage } from './base-dashboard-widget.component';

/** What the host is currently rendering inside its card body. */
export type DashboardWidgetHostState = 'missing' | 'forbidden' | 'loading' | 'error' | 'ready';

/** Widths offered in the resize menu when a widget declares no `supportedWidths`. */
const FALLBACK_WIDTHS: number[] = [3, 4, 6, 8, 12];

/** Shared empty objects, so identity stays stable across change detection. */
const EMPTY_CONFIG: Record<string, unknown> = Object.freeze({});
const EMPTY_INPUTS: Record<string, unknown> = Object.freeze({});

/**
 * Public input names declared by a dynamically rendered component, cached per
 * component type.
 *
 * `ComponentRef.setInput()` logs an NG0303 error for inputs the component does
 * not declare, and `*ngComponentOutlet` calls it for every key of its `inputs`
 * binding — so the host must filter the bag down to what the widget accepts.
 */
const declaredInputsCache = new WeakMap<Type<unknown>, ReadonlySet<string>>();

/**
 * Returns the public (template) input names of a component type.
 *
 * @param component - The dynamically resolved widget component.
 */
function declaredInputs(component: Type<unknown>): ReadonlySet<string> {
	const cached = declaredInputsCache.get(component);
	if (cached) {
		return cached;
	}
	const mirror = reflectComponentType(component);
	const names = new Set<string>((mirror?.inputs ?? []).map((meta) => meta.templateName));
	declaredInputsCache.set(component, names);
	return names;
}

/**
 * Normalizes whatever a registry `title` resolver returned into an observable.
 *
 * A resolver may hand back a plain string, a promise, or an observable, and the
 * host treats all three the same way.
 *
 * @param resolved - The raw value produced by the resolver.
 */
function toTitleStream(resolved: unknown): Observable<string> {
	if (isObservable(resolved)) {
		return resolved as Observable<string>;
	}
	if (resolved instanceof Promise) {
		return from(resolved as Promise<string>);
	}
	return of(resolved as string);
}

/** Coerces a config value that may hold a single id or a list of ids. */
function toIdArray(value: unknown): ID[] | undefined {
	if (Array.isArray(value)) {
		const ids = value.filter((id): id is ID => typeof id === 'string' && !!id);
		return ids.length ? ids : undefined;
	}
	return typeof value === 'string' && value ? [value as ID] : undefined;
}

/**
 * Reads the scope overrides out of a placement's persisted configuration.
 *
 * This is what lets the same widget be dropped twice on one canvas and scoped
 * differently — e.g. one instance pinned to a single project while the page
 * selector still says "all projects". Both the singular (`projectId`) and plural
 * (`projectIds`) spellings are accepted, because a `configSchema` field of type
 * `project` stores a single id while a multi-select stores a list.
 *
 * Only the scope is overridable; the reporting window, organization and time
 * zone always come from the page.
 *
 * @param config - The placement's persisted configuration.
 * @returns The overrides, or `undefined` when the widget inherits everything.
 */
export function toContextOverrides(
	config: Record<string, unknown> | undefined
): IDashboardWidgetContextOverrides | undefined {
	if (!config) {
		return undefined;
	}

	const employeeIds = toIdArray(config['employeeIds'] ?? config['employeeId']);
	const projectIds = toIdArray(config['projectIds'] ?? config['projectId']);
	const teamIds = toIdArray(config['teamIds'] ?? config['teamId']);

	if (!employeeIds && !projectIds && !teamIds) {
		return undefined;
	}
	return { employeeIds, projectIds, teamIds };
}

/**
 * Config field types the builder's configuration dialog knows how to render.
 *
 * `employee` / `project` / `team` are declared by {@link WidgetConfigField} but
 * have no picker yet: the shared page selectors are store-bound (they write
 * `Store.selectedProject` / `selectedEmployee` and rewrite the route's query
 * params), so dropping one into a modal would silently re-scope the whole page.
 *
 * TODO(dashboard-builder): add modal-safe entity pickers and delete this set.
 */
const RENDERABLE_CONFIG_TYPES: ReadonlySet<WidgetConfigField['type']> = new Set<WidgetConfigField['type']>([
	'text',
	'number',
	'boolean',
	'select'
]);

/**
 * The subset of a widget's `configSchema` the configuration dialog can render.
 *
 * Shared with the dialog on purpose: the kebab's "Configure" entry is gated on
 * this being non-empty, so the menu can never advertise a dialog that would open
 * with nothing in it.
 *
 * @param schema - The widget's declared configuration schema.
 * @returns The renderable fields, in declaration order.
 */
export function renderableConfigFields(schema: WidgetConfigField[] | undefined): WidgetConfigField[] {
	return (schema ?? []).filter((field) => !!field?.key && RENDERABLE_CONFIG_TYPES.has(field.type));
}

/**
 * Card frame around one widget instance on a dashboard canvas.
 *
 * The host owns everything that is NOT the widget's own content: the title, the
 * edit-mode kebab menu (configure / resize / remove), the loading skeleton, the
 * error state with retry, and the two placeholders that keep a saved dashboard
 * usable when its widgets are unavailable —
 *
 * - **missing**: the `widgetId` is not in the registry (its plugin was disabled
 *   or the widget was removed). A saved dashboard must never crash on this.
 * - **forbidden**: the widget declares permissions the current user lacks.
 *
 * The widget itself is created dynamically and receives
 * {@link DASHBOARD_WIDGET_CONTEXT} (narrowed by `placement.config`) and
 * {@link DASHBOARD_WIDGET_CONFIG} through a per-instance injector.
 */
@UntilDestroy()
@Component({
	selector: 'ga-dashboard-widget-host',
	standalone: true,
	imports: [CommonModule, NbButtonModule, NbCardModule, NbIconModule, NbPopoverModule, TranslateModule],
	templateUrl: './dashboard-widget-host.component.html',
	styleUrls: ['./dashboard-widget-host.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardWidgetHostComponent {
	private readonly registry = inject(WidgetRegistryService);
	private readonly store = inject(Store);
	private readonly injector = inject(Injector);
	private readonly translateService = inject(TranslateService);
	private readonly contextService = inject(DashboardContextService);

	/**
	 * Context stream provided by an ancestor, when the page wants to override the
	 * default source (mini dashboards, previews, tests). When absent the host
	 * falls back to the application-wide {@link DashboardContextService}.
	 */
	private readonly ambientContext$: Observable<IDashboardWidgetContext> | null = inject(DASHBOARD_WIDGET_CONTEXT, {
		optional: true
	});

	/** The placement this host renders. */
	readonly placement = input.required<IDashboardWidgetPlacement>();

	/** Whether the canvas is in edit mode (shows the kebab menu). */
	readonly editing = input(false, { transform: booleanAttribute });

	/*
	|--------------------------------------------------------------------------
	| Outputs
	|--------------------------------------------------------------------------
	| Past-tense / `*Requested` names on purpose: an output named after a native
	| DOM event (`remove`, `resize`, ...) shadows that event on the host element,
	| so a consumer binding it can fire twice or bind something else entirely.
	*/

	/** The user asked to remove this placement from the canvas. */
	readonly removed = output<IDashboardWidgetPlacement>();

	/**
	 * The user asked to configure this placement.
	 *
	 * Deliberately payload-less: the host does not own the settings dialog, and
	 * the parent already knows which placement it bound. Emitting a payload here
	 * would be mistaken for "the new configuration" by canvases that persist it.
	 */
	readonly configureRequested = output<void>();

	/** The user picked a new width (in grid columns) for this placement. */
	readonly resized = output<{ w: number }>();

	/** Bumped whenever the registry changes, so a late-registered plugin appears. */
	private readonly registryVersion = signal(0);

	/** Bumped whenever role permissions change, so access is re-evaluated. */
	private readonly permissionsVersion = signal(0);

	/** Bumped on every language change, so a translated title is re-resolved. */
	private readonly langVersion = signal(0);

	/** The resolved widget component, or `null` while loading/unavailable. */
	readonly component = signal<Type<unknown> | null>(null);

	/** True while the widget's component bundle is being resolved. */
	readonly loading = signal(false);

	/** Message of the failed component resolution, or `null`. */
	readonly loadError = signal<string | null>(null);

	/** Resolved (but not yet translated) widget title. */
	private readonly resolvedTitle = signal<string>('');

	/** Guards against out-of-order async resolutions. */
	private loadToken = 0;
	private titleToken = 0;

	/** The kebab menu popover, so an action can close it. */
	private readonly popover = viewChild(NbPopoverDirective);

	/** The registry key of the placed widget. */
	readonly widgetId = computed<string>(() => this.placement().widgetId);

	/** The placement's persisted configuration (stable identity when absent). */
	readonly widgetConfig = computed<Record<string, unknown>>(() => this.placement().config ?? EMPTY_CONFIG);

	/** Registry entry behind the placement, or `undefined` when unavailable. */
	readonly widget = computed<WidgetRegistryConfig | undefined>(() => {
		this.registryVersion();
		return this.registry.getWidget(this.widgetId());
	});

	/** Whether the current user may see this widget. */
	readonly hasAccess = computed<boolean>(() => {
		this.permissionsVersion();
		const permissions = this.widget()?.permissions ?? [];
		// `Store.hasAnyPermission()` answers `false` for an empty list, but a
		// widget that requires nothing must stay visible to everybody.
		if (!permissions.length) {
			return true;
		}
		return this.store.hasAnyPermission(...(permissions as PermissionsEnum[]));
	});

	/** Whether the placement is temporarily hidden. */
	readonly hidden = computed<boolean>(() => !!this.placement().hidden);

	/** What the card body renders. */
	readonly state = computed<DashboardWidgetHostState>(() => {
		const widget = this.widget();
		if (!widget?.loadComponent) {
			return 'missing';
		}
		if (!this.hasAccess()) {
			return 'forbidden';
		}
		if (this.loadError()) {
			return 'error';
		}
		return this.component() ? 'ready' : 'loading';
	});

	/** Title (or translation key) shown in the card header. */
	readonly title = computed<string>(() => this.resolvedTitle() || 'DASHBOARD_PAGE.BUILDER.HOST.UNTITLED_WIDGET');

	/**
	 * Whether the widget exposes per-instance settings the dialog can render.
	 *
	 * The kebab menu only offers "Configure" when this is true, so the action is
	 * never a dead end — neither for a widget with nothing to configure, nor for
	 * one whose whole schema uses a field type the dialog cannot render yet (see
	 * {@link renderableConfigFields}).
	 */
	readonly configurable = computed<boolean>(() => renderableConfigFields(this.widget()?.configSchema).length > 0);

	/** Widths offered by the resize menu, clamped to the widget's min/max size. */
	readonly widthOptions = computed<number[]>(() => {
		const widget = this.widget();
		// Annotated `number[]` on purpose: `supportedWidths` is the literal union
		// `WidgetGridWidth[]`, and calling `.filter()` on an un-widened
		// `WidgetGridWidth[] | number[]` union resolves against two overloaded
		// signatures — which TypeScript refuses to call.
		const widths: number[] = widget?.supportedWidths?.length ? [...widget.supportedWidths] : FALLBACK_WIDTHS;
		const min = widget?.minSize?.w ?? 1;
		const max = widget?.maxSize?.w ?? DASHBOARD_GRID_COLUMNS;
		return widths
			.filter((width) => width >= min && width <= max && width <= DASHBOARD_GRID_COLUMNS)
			.sort((a, b) => a - b);
	});

	/**
	 * Per-instance injector handed to the widget.
	 *
	 * Depends ONLY on the widget id and the config object identity: changing
	 * `ngComponentOutletInjector` destroys and recreates the component, so it
	 * must not change while a placement is merely being dragged or resized (the
	 * layout utils shallow-copy placements, keeping `config` identity stable).
	 */
	readonly widgetInjector = computed<Injector>(() => {
		const widgetId = this.widgetId();
		const config = this.widgetConfig();
		const overrides = toContextOverrides(config);
		const context$ = this.ambientContext$
			? this.ambientContext$.pipe(
					map((context: IDashboardWidgetContext) => narrowDashboardContext(context, overrides)),
					shareReplay({ bufferSize: 1, refCount: true })
				)
			: this.contextService.contextFor(overrides);

		return Injector.create({
			name: `dashboard-widget:${widgetId}`,
			parent: this.injector,
			providers: [
				{ provide: DASHBOARD_WIDGET_CONTEXT, useValue: context$ },
				{ provide: DASHBOARD_WIDGET_CONFIG, useValue: config }
			]
		});
	});

	/**
	 * Inputs forwarded to the widget, filtered down to the ones it declares.
	 *
	 * DI is the contract; these are a convenience for simple presentational
	 * widgets that only need their placement/config.
	 */
	readonly widgetInputs = computed<Record<string, unknown>>(() => {
		const component = this.component();
		if (!component) {
			return EMPTY_INPUTS;
		}
		const declared = declaredInputs(component);
		if (!declared.size) {
			return EMPTY_INPUTS;
		}

		const candidates: Record<string, unknown> = {
			placement: this.placement(),
			config: this.widgetConfig(),
			editing: this.editing()
		};

		const inputs: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(candidates)) {
			if (declared.has(key)) {
				inputs[key] = value;
			}
		}
		return Object.keys(inputs).length ? inputs : EMPTY_INPUTS;
	});

	constructor() {
		// A plugin may register its widgets after the dashboard has rendered — a
		// "missing widget" placeholder must recover when that happens.
		this.registry.widgets$.pipe(untilDestroyed(this)).subscribe(() => this.registryVersion.update((v) => v + 1));

		// Role permissions arrive asynchronously after sign-in / tenant switch.
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => this.permissionsVersion.update((v) => v + 1));

		// A widget title may be produced by a ResolveFn that translates eagerly, so
		// it has to be re-resolved on a language change. Routed through a signal
		// rather than resolved here directly: only the effect below is guaranteed
		// to run after the required `placement` input has been set.
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => this.langVersion.update((v) => v + 1));

		// Resolve the component whenever the placed widget (or access to it) changes.
		effect(() => this.loadWidgetComponent(this.widgetId(), this.widget(), this.hasAccess()));

		// Keep the header title in sync with the placement override / registry entry.
		effect(() => {
			this.langVersion();
			this.resolveTitle(this.placement().title, this.widget());
		});
	}

	/** Emits {@link configureRequested} for this placement and closes the menu. */
	onConfigure(): void {
		this.closeMenu();
		this.configureRequested.emit();
	}

	/** Emits {@link removed} for this placement and closes the menu. */
	onRemove(): void {
		this.closeMenu();
		this.removed.emit(this.placement());
	}

	/**
	 * Emits {@link resized} with the picked width and closes the menu.
	 *
	 * @param width - New span in grid columns.
	 */
	onResize(width: number): void {
		this.closeMenu();
		this.resized.emit({ w: width });
	}

	/** Retries a failed component resolution. */
	retry(): void {
		this.loadWidgetComponent(this.widgetId(), this.widget(), this.hasAccess());
	}

	/** Hides the kebab popover, if it is open. */
	private closeMenu(): void {
		this.popover()?.hide();
	}

	/**
	 * Resolves (and caches, via the registry) the component backing a placement.
	 *
	 * @param widgetId - The placement's registry key.
	 * @param widget - The registry entry, when it exists.
	 * @param hasAccess - Whether the user may see the widget.
	 */
	private loadWidgetComponent(widgetId: string, widget: WidgetRegistryConfig | undefined, hasAccess: boolean): void {
		const token = ++this.loadToken;
		this.component.set(null);
		this.loadError.set(null);

		// Nothing to load: the placeholders are rendered from `state()` instead.
		if (!widget?.loadComponent || !hasAccess) {
			this.loading.set(false);
			return;
		}

		this.loading.set(true);
		this.registry
			.resolveComponent(widgetId)
			.then((component: Type<unknown> | null) => {
				if (token !== this.loadToken) {
					return; // A newer load superseded this one.
				}
				this.loading.set(false);
				this.component.set(component);
			})
			.catch((error: unknown) => {
				if (token !== this.loadToken) {
					return;
				}
				this.loading.set(false);
				this.loadError.set(toErrorMessage(error));
			});
	}

	/**
	 * Resolves the header title: the user's override wins, otherwise the registry
	 * title — which may be a plain string, a translation key, or a `ResolveFn`
	 * returning any of those (possibly asynchronously).
	 *
	 * @param override - `placement.title`, set when the user renamed the widget.
	 * @param widget - The registry entry, when it exists.
	 */
	private resolveTitle(override: string | undefined, widget: WidgetRegistryConfig | undefined): void {
		const token = ++this.titleToken;

		if (override) {
			this.resolvedTitle.set(override);
			return;
		}

		const title = widget?.title;
		if (!title) {
			this.resolvedTitle.set('');
			return;
		}
		if (typeof title === 'string') {
			this.resolvedTitle.set(title);
			return;
		}

		let resolved: unknown;
		try {
			// Registry resolvers are plain functions that may call `inject()`, and
			// they never actually read the route arguments of a `ResolveFn`.
			resolved = runInInjectionContext(this.injector, () =>
				(title as ResolveFn<string>)(null as never, null as never)
			);
		} catch (error) {
			if (isDevMode()) {
				console.warn(`[ga-dashboard-widget-host] Failed to resolve title for "${this.widgetId()}"`, error);
			}
			this.resolvedTitle.set('');
			return;
		}

		toTitleStream(resolved)
			.pipe(take(1), untilDestroyed(this))
			.subscribe({
				next: (value: string) => {
					if (token === this.titleToken) {
						this.resolvedTitle.set(value ?? '');
					}
				},
				error: () => {
					if (token === this.titleToken) {
						this.resolvedTitle.set('');
					}
				}
			});
	}
}
