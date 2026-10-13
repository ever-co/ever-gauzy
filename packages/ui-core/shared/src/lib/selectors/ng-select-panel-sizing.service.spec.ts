import { TestBed } from '@angular/core/testing';
import { NG_SELECT_TRIGGER_WIDTH_VAR, NgSelectPanelSizingService } from './ng-select-panel-sizing.service';

/**
 * ng-select 24 renders its panel in a CDK overlay pane and no longer floors it at the select's
 * width; the owner saw the header's organization panel shrink to its 52 px logo pill. These pin
 * how the service finds a panel's select (ARIA) and where it writes the width (a custom property
 * the CDK never rewrites).
 */
describe('NgSelectPanelSizingService', () => {
	let service: NgSelectPanelSizingService;

	/** A select whose open input names `listboxId`, measuring `width` px. */
	const addSelect = (listboxId: string, width: number) => {
		const select = document.createElement('ng-select');
		const input = document.createElement('input');
		input.setAttribute('aria-controls', listboxId);
		select.appendChild(input);
		select.getBoundingClientRect = () => ({ width }) as DOMRect;
		document.body.appendChild(select);
		return select;
	};

	/** `.cdk-overlay-container > bounding box > .cdk-overlay-pane > ng-dropdown-panel > [role=listbox]`. */
	const buildOverlay = (listboxId: string) => {
		const container = document.createElement('div');
		container.className = 'cdk-overlay-container';
		const box = document.createElement('div');
		box.className = 'cdk-overlay-connected-position-bounding-box';
		const pane = document.createElement('div');
		pane.className = 'cdk-overlay-pane';
		const panel = document.createElement('ng-dropdown-panel');
		const listbox = document.createElement('div');
		listbox.setAttribute('role', 'listbox');
		listbox.id = listboxId;
		panel.appendChild(listbox);
		pane.appendChild(panel);
		box.appendChild(pane);
		container.appendChild(box);
		return { container, box, pane, panel };
	};

	const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

	beforeEach(() => {
		document.body.innerHTML = '';
		TestBed.configureTestingModule({});
		service = TestBed.inject(NgSelectPanelSizingService);
	});

	afterEach(() => service.ngOnDestroy());

	it('writes the select width onto the pane that holds its panel', () => {
		addSelect('lb-org', 52);
		const { container, pane, panel } = buildOverlay('lb-org');
		document.body.appendChild(container);

		expect(service.sizePanel(panel)).toBe(52);
		expect(pane.style.getPropertyValue(NG_SELECT_TRIGGER_WIDTH_VAR)).toBe('52px');
	});

	it('leaves a pane alone when no open select names its listbox', () => {
		addSelect('lb-other', 300);
		const { container, pane, panel } = buildOverlay('lb-org');
		document.body.appendChild(container);

		expect(service.sizePanel(panel)).toBeNull();
		expect(pane.style.getPropertyValue(NG_SELECT_TRIGGER_WIDTH_VAR)).toBe('');
	});

	it('sizes panels attached after start, in containers created after start', async () => {
		service.start();
		addSelect('lb-project', 180);
		const { container, box, pane } = buildOverlay('lb-project');
		// ng-select creates its own overlay container lazily, then attaches the pane into it.
		container.removeChild(box);
		document.body.appendChild(container);
		await flush();
		container.appendChild(box);
		await flush();

		expect(pane.style.getPropertyValue(NG_SELECT_TRIGGER_WIDTH_VAR)).toBe('180px');
	});

	it('does not re-measure on option re-renders inside an open panel', async () => {
		service.start();
		const select = addSelect('lb-team', 120);
		const { container, pane, panel } = buildOverlay('lb-team');
		document.body.appendChild(container);
		await flush();
		expect(pane.style.getPropertyValue(NG_SELECT_TRIGGER_WIDTH_VAR)).toBe('120px');

		select.getBoundingClientRect = () => ({ width: 999 }) as DOMRect;
		panel.querySelector('[role="listbox"]')!.appendChild(document.createElement('div'));
		await flush();

		expect(pane.style.getPropertyValue(NG_SELECT_TRIGGER_WIDTH_VAR)).toBe('120px');
	});
});
