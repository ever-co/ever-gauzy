import * as core from '@angular/core';
import { EventEmitter, Injector, runInInjectionContext } from '@angular/core';
import { ConnectedPosition, FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { NgSelectComponent } from '@ng-select/ng-select';
import {
	ENTITY_SELECT_PANEL_POSITIONS,
	ENTITY_SELECT_PANEL_VIEWPORT_MARGIN,
	EntitySelectPanelDirective,
	withEndAlignedFallbacks
} from './entity-select-panel.directive';

/**
 * A widened entity-select panel has to stay on screen: the header's organization pill sits at the
 * right edge, and ng-select's own positions are start-aligned only, with push off — and ng-select
 * re-applies that list from an effect on every open, after `(open)` has fired.
 */
jest.mock('@angular/core', () => {
	const actual = jest.requireActual('@angular/core');
	return { ...actual, afterNextRender: jest.fn() };
});

describe('EntitySelectPanelDirective', () => {
	beforeEach(() => {
		(core.afterNextRender as jest.Mock).mockImplementation((spec: { write: () => void }) => {
			pendingRender.push(spec.write);
			return { destroy: () => undefined };
		});
	});

	const BELOW: ConnectedPosition = { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' };
	const ABOVE: ConnectedPosition = { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' };
	/** `afterNextRender` needs a render to run after: the tests run it through the stub below. */
	let pendingRender: (() => void)[] = [];
	const flush = async () => {
		const run = pendingRender;
		pendingRender = [];
		run.forEach((callback) => callback());
	};

	/** ng-select's `auto` list is `[BELOW, ABOVE]`, its `top` list `[ABOVE]`. */
	const build = (options: { attached?: boolean; positions?: ConnectedPosition[] } = {}) => {
		const strategy = Object.create(FlexibleConnectedPositionStrategy.prototype) as FlexibleConnectedPositionStrategy;
		const setPositions = jest.fn(function (this: any, positions: ConnectedPosition[]) {
			this._preferredPositions = positions; // backs the CDK `positions` getter
			return this;
		});
		strategy.withPositions = setPositions as any;
		strategy.withPush = jest.fn().mockReturnValue(strategy);
		strategy.withViewportMargin = jest.fn().mockReturnValue(strategy);
		strategy.withPositions(options.positions ?? [BELOW, ABOVE]); // what ng-select did before attaching
		setPositions.mockClear();
		const overlayRef = {
			hasAttached: () => options.attached ?? true,
			getConfig: () => ({ positionStrategy: strategy }),
			updatePosition: jest.fn()
		};
		const select = { openEvent: new EventEmitter<void>(), dropdownOverlayRef: overlayRef };
		const injector = Injector.create({ providers: [{ provide: NgSelectComponent, useValue: select }] });
		runInInjectionContext(injector, () => new EntitySelectPanelDirective());
		return { select, strategy, setPositions, overlayRef };
	};

	it('pairs every start-aligned position with its end-aligned twin, in order', () => {
		expect(withEndAlignedFallbacks([BELOW, ABOVE])).toEqual(ENTITY_SELECT_PANEL_POSITIONS);
		expect(withEndAlignedFallbacks([ABOVE]).map((p) => [p.originY, p.originX])).toEqual([
			['top', 'start'],
			['top', 'end']
		]);
	});

	it('adds the end-aligned fallbacks and push once the panel is attached', async () => {
		const { select, strategy, setPositions, overlayRef } = build();
		select.openEvent.emit();
		expect(setPositions).not.toHaveBeenCalled(); // `open` fires before the attach; the render follows
		await flush();

		expect(setPositions).toHaveBeenLastCalledWith(ENTITY_SELECT_PANEL_POSITIONS);
		expect(strategy.withPush).toHaveBeenCalledWith(true);
		// Greptile TREX: pushed at a narrow width, the organization panel sat flush on the left edge.
		expect(strategy.withViewportMargin).toHaveBeenCalledWith(ENTITY_SELECT_PANEL_VIEWPORT_MARGIN);
		expect(overlayRef.updatePosition).toHaveBeenCalled();
	});

	it('keeps augmenting the list ng-select re-applies on later opens', async () => {
		const { select, strategy, setPositions } = build();
		select.openEvent.emit();
		await flush();

		// ng-select's effect re-states its own list after the open.
		strategy.withPositions([BELOW, ABOVE]);
		expect(setPositions).toHaveBeenLastCalledWith(ENTITY_SELECT_PANEL_POSITIONS);

		// …and a second open does not stack a second wrapper.
		select.openEvent.emit();
		await flush();
		expect(setPositions).toHaveBeenLastCalledWith(ENTITY_SELECT_PANEL_POSITIONS);
	});

	it('keeps an above-only select above', async () => {
		const { select, setPositions } = build({ positions: [ABOVE] });
		select.openEvent.emit();
		await flush();

		const positions = setPositions.mock.calls.at(-1)![0] as ConnectedPosition[];
		expect(positions.every((p) => p.originY === 'top')).toBe(true);
		expect(positions).toHaveLength(2);
	});

	it('does nothing while no panel is attached', async () => {
		const { select, setPositions, overlayRef } = build({ attached: false });
		select.openEvent.emit();
		await flush();

		expect(setPositions).not.toHaveBeenCalled();
		expect(overlayRef.updatePosition).not.toHaveBeenCalled();
	});
});
