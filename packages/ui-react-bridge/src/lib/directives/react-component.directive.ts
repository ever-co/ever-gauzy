import {
	Directive,
	ElementRef,
	Injector,
	inject,
	Input,
	OnDestroy,
	OnInit,
	OnChanges,
	SimpleChanges
} from '@angular/core';
import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import { NgContextProvider } from '../ng-react-context';

/**
 * Directive that renders a React component inside an Angular template.
 * The component receives the Angular injector via context and can use useInjector().
 *
 * @example
 * ```html
 * <div [gzReactHost]="MyReactComponent" [props]="componentProps"></div>
 * ```
 *
 * With extra context:
 * ```html
 * <div [gzReactHost]="KanbanBoard" [props]="props" [context]="ctx"></div>
 * ```
 */
@Directive({
	selector: '[gzReactHost]',
	standalone: true
})
export class ReactHostDirective implements OnInit, OnChanges, OnDestroy {
	private readonly host = inject(ElementRef);
	private readonly injector = inject(Injector);
	private root: Root | null = null;

	@Input({ required: true }) gzReactHost!: React.ComponentType<unknown>;
	@Input() props: Record<string, unknown> = {};
	@Input() context: Record<string, unknown> = {};

	ngOnInit(): void {
		this.root = createRoot(this.host.nativeElement);
		this.render();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (this.root && (changes['gzReactHost'] || changes['props'] || changes['context'])) {
			this.render();
		}
	}

	private render(): void {
		if (!this.root || !this.gzReactHost) return;

		const Component = this.gzReactHost;
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
