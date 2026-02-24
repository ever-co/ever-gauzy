import { Directive, ElementRef, inject, Injector, Input, OnDestroy, OnInit } from '@angular/core';
import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import { NgContextProvider } from '../ng-react-context';

/**
 * Directive that lazy-loads a React component via dynamic import and renders it.
 * Use for code-splitting: React chunks are loaded only when the directive is used.
 *
 * @example
 * ```html
 * <div
 *   [gzReactLazyHost]="loadKanban"
 *   [props]="kanbanProps">
 * </div>
 * ```
 *
 * ```ts
 * loadKanban = () => import('./kanban/KanbanBoard').then(m => m);
 * kanbanProps = { columns: this.columns };
 * ```
 */
@Directive({
	selector: '[gzReactLazyHost]',
	standalone: true
})
export class LazyReactHostDirective implements OnInit, OnDestroy {
	private readonly host = inject(ElementRef);
	private readonly injector = inject(Injector);
	private root: Root | null = null;

	@Input({ required: true })
	gzReactLazyHost!: () => Promise<{ default: React.ComponentType<unknown> }>;

	@Input() props: Record<string, unknown> = {};
	/** Extra context merged with injector (accessible via useBridgeContext) */
	@Input() context: Record<string, unknown> = {};

	async ngOnInit(): Promise<void> {
		const module = await this.gzReactLazyHost();
		const Component = module.default;

		if (!Component) {
			console.error('LazyReactDirective: module.default is not a React component');
			return;
		}

		this.root = createRoot(this.host.nativeElement);
		const componentProps = this.props ?? {};
		const bridgeContext = this.context ?? {};

		this.root.render(
			React.createElement(
				NgContextProvider,
				{ injector: this.injector, context: bridgeContext },
				React.createElement(Component, componentProps)
			)
		);
	}

	ngOnDestroy(): void {
		this.root?.unmount();
		this.root = null;
	}
}
