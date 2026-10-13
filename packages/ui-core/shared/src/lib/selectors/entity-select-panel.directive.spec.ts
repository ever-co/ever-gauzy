import { EventEmitter, Injector, runInInjectionContext } from '@angular/core';
import { FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { NgSelectComponent } from '@ng-select/ng-select';
import { ENTITY_SELECT_PANEL_POSITIONS, EntitySelectPanelDirective } from './entity-select-panel.directive';

/**
 * A widened entity-select panel has to stay on screen: the header's organization pill sits at the
 * right edge, and ng-select's own positions are start-aligned only, with push off.
 */
describe('EntitySelectPanelDirective', () => {
	const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

	const build = (options: { attached?: boolean; position?: string } = {}) => {
		const strategy = Object.create(FlexibleConnectedPositionStrategy.prototype) as FlexibleConnectedPositionStrategy;
		strategy.withPositions = jest.fn().mockReturnValue(strategy);
		strategy.withPush = jest.fn().mockReturnValue(strategy);
		const overlayRef = {
			hasAttached: () => options.attached ?? true,
			getConfig: () => ({ positionStrategy: strategy }),
			updatePosition: jest.fn()
		};
		const select = {
			openEvent: new EventEmitter<void>(),
			dropdownPosition: () => options.position ?? 'auto',
			dropdownOverlayRef: overlayRef,
			element: document.createElement('ng-select')
		};
		const injector = Injector.create({ providers: [{ provide: NgSelectComponent, useValue: select }] });
		const directive = runInInjectionContext(injector, () => new EntitySelectPanelDirective());
		return { directive, select, strategy, overlayRef };
	};

	it('adds the end-aligned fallbacks and push once the panel is attached', async () => {
		const { select, strategy, overlayRef } = build();
		select.openEvent.emit();
		expect(strategy.withPositions).not.toHaveBeenCalled(); // `open` fires before the attach
		await flush();

		expect(strategy.withPositions).toHaveBeenCalledWith(ENTITY_SELECT_PANEL_POSITIONS);
		expect(strategy.withPush).toHaveBeenCalledWith(true);
		expect(overlayRef.updatePosition).toHaveBeenCalled();
	});

	it('keeps an above-first select above first', async () => {
		const { select, strategy } = build({ position: 'top' });
		select.openEvent.emit();
		await flush();

		const positions = (strategy.withPositions as jest.Mock).mock.calls[0][0];
		expect(positions[0].overlayY).toBe('bottom');
		expect(positions).toHaveLength(4);
	});

	it('does nothing while no panel is attached', async () => {
		const { select, strategy, overlayRef } = build({ attached: false });
		select.openEvent.emit();
		await flush();

		expect(strategy.withPositions).not.toHaveBeenCalled();
		expect(overlayRef.updatePosition).not.toHaveBeenCalled();
	});
});
