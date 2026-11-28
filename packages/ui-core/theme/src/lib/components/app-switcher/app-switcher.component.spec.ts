import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NbOverlayContainerAdapter, NbPopoverModule } from '@nebular/theme';
import { EVER_APPS, IEverApp } from '@gauzy/ui-core/common';
import { ElectronService } from '@gauzy/ui-core/core';
import { GAUZY_ENV } from '@gauzy/ui-config';
import { AppSwitcherComponent } from './app-switcher.component';

/** One app of the list, shaped as the Ever Platform module's catalog (`EVER_APP_CATALOG`) shapes it. */
function app(id: IEverApp['id'], shortName: string, extra: Partial<IEverApp> = {}): IEverApp {
	return {
		id,
		shortName,
		name: `Ever ${shortName}`,
		lineKey: `APP_LAUNCHER.LINES.${id.toUpperCase()}`,
		logo: `assets/images/ever-apps/${id}.svg`,
		url: `https://${id}.catalog.test`,
		domain: `${id}.catalog.test`,
		...extra
	};
}

/** The eight Ever apps, in the order every Ever app shares. */
const APPS: ReadonlyArray<IEverApp> = [
	app('platform', 'Platform'),
	app('works', 'Works'),
	app('teams', 'Teams'),
	app('gauzy', 'Gauzy'),
	app('rec', 'Rec'),
	app('traduora', 'Traduora'),
	app('demand', 'Demand', { status: 'soon' }),
	app('tech', 'Tech')
];

interface SetupOptions {
	apps?: ReadonlyArray<IEverApp>;
	environment?: Record<string, string>;
	/** The desktop apps' Electron shell; none in the browser. */
	shell?: { openExternal: jest.Mock };
}

function setup(options: SetupOptions = {}): ComponentFixture<AppSwitcherComponent> {
	const providers: unknown[] = [
		{ provide: EVER_APPS, useValue: options.apps ?? APPS },
		{
			provide: GAUZY_ENV,
			useValue: options.environment ?? { CLIENT_BASE_URL: 'https://gauzy.deployment.test' }
		}
	];
	if (options.shell) {
		providers.push({ provide: ElectronService, useValue: { shell: options.shell } });
	}
	// The templates are inlined by the Jest transform: nothing to compile ahead.
	TestBed.configureTestingModule({
		declarations: [AppSwitcherComponent],
		imports: [NbPopoverModule],
		providers: providers as never[]
	});
	// The app puts Nebular overlays in its <nb-layout>; a unit test has none, so they go in the body.
	TestBed.inject(NbOverlayContainerAdapter).setContainer(document.body);
	const fixture: ComponentFixture<AppSwitcherComponent> = TestBed.createComponent(AppSwitcherComponent);
	fixture.detectChanges();
	return fixture;
}

function trigger(fixture: ComponentFixture<AppSwitcherComponent>): HTMLButtonElement {
	return fixture.nativeElement.querySelector('button.app-switcher-trigger');
}

/** Opens the list as a press does, and returns it (it lives in the overlay, outside the component). */
function open(fixture: ComponentFixture<AppSwitcherComponent>): HTMLElement {
	trigger(fixture).click();
	fixture.detectChanges();
	tick();
	fixture.detectChanges();
	const panel = document.getElementById(fixture.componentInstance.panelId);
	if (!panel) {
		throw new Error('the list did not open');
	}
	return panel;
}

/** Clicks a link the way a person does, and tells whether something stopped the browser from following it. */
function click(link: HTMLElement): { followed: boolean } {
	const event = new MouseEvent('click', { bubbles: true, cancelable: true });
	let followed = true;
	// Runs after the component's own handler; stops jsdom, which cannot navigate, from trying.
	const watch = (seen: Event) => {
		followed = !seen.defaultPrevented;
		seen.preventDefault();
	};
	document.addEventListener('click', watch, { once: true });
	link.dispatchEvent(event);
	return { followed };
}

describe('AppSwitcherComponent (the App Launcher list)', () => {
	afterEach(() => {
		document.querySelectorAll('.cdk-overlay-container').forEach((container) => (container.innerHTML = ''));
	});

	it('lists the eight Ever apps in order, then "+ Add" last', fakeAsync(() => {
		const fixture = setup();
		const panel = open(fixture);
		const rows = Array.from(panel.querySelectorAll('.app-switcher-list > li'));
		expect(rows).toHaveLength(9);
		expect(rows.slice(0, 8).map((row) => row.querySelector('.app-name')?.textContent?.trim())).toEqual([
			'Ever Platform',
			'Ever Works',
			'Ever Teams',
			'Ever Gauzy',
			'Ever Rec',
			'Ever Traduora',
			'Ever Demand',
			'Ever Tech'
		]);
		expect(rows[8].classList).toContain('app-add-item');
		expect(rows[8].querySelector('.app-name')?.textContent?.trim()).toBe('APP_LAUNCHER.ADD');
	}));

	it("shows each app's logo, full name and one line, and no address", fakeAsync(() => {
		const fixture = setup();
		const panel = open(fixture);
		const rows = Array.from(panel.querySelectorAll<HTMLElement>('.app-row:not(.add)'));
		expect(rows).toHaveLength(8);
		rows.forEach((row, index) => {
			expect(row.querySelector('img.app-tile')?.getAttribute('src')).toBe(APPS[index].logo);
			expect(row.querySelector('.app-line')?.textContent?.trim()).toBe(APPS[index].lineKey);
		});
		const text = panel.textContent ?? '';
		for (const listed of APPS) {
			expect(text).not.toContain(listed.domain);
			expect(text).not.toContain(listed.url);
		}
		expect(text).not.toContain('gauzy.deployment.test');
		expect(panel.querySelector('.app-domain')).toBeNull();
	}));

	it('opens every other app in the same tab: a plain link, no target, no rel', fakeAsync(() => {
		const fixture = setup();
		const panel = open(fixture);
		const links = Array.from(panel.querySelectorAll<HTMLAnchorElement>('a.app-row'));
		// Seven other apps and "+ Add"
		expect(links).toHaveLength(8);
		for (const link of links) {
			expect(link.hasAttribute('target')).toBe(false);
			expect(link.hasAttribute('rel')).toBe(false);
		}
		expect(links.slice(0, 7).map((link) => link.getAttribute('href'))).toEqual(
			APPS.filter((listed) => listed.id !== 'gauzy').map((listed) => listed.url)
		);

		const works = links[1];
		expect(click(works).followed).toBe(true);
		fixture.detectChanges();
		tick();
		// The list closes and gives the focus back to its button
		expect(document.getElementById(fixture.componentInstance.panelId)).toBeNull();
		expect(document.activeElement).toBe(trigger(fixture));
	}));

	it('marks the current app, which is not a link', fakeAsync(() => {
		const fixture = setup();
		const panel = open(fixture);
		const current = panel.querySelector('.app-row.current');
		expect(current?.tagName).toBe('DIV');
		expect(current?.getAttribute('aria-current')).toBe('page');
		expect(current?.querySelector('.app-name')?.textContent?.trim()).toBe('Ever Gauzy');
		expect(current?.querySelector('.app-chip.here')?.textContent?.trim()).toBe('APP_LAUNCHER.YOU_ARE_HERE');
		expect(panel.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
	}));

	it('keeps "Soon" beside Ever Demand while the deployment does not link it', fakeAsync(() => {
		const fixture = setup();
		const panel = open(fixture);
		const chips = Array.from(panel.querySelectorAll('a.app-row .app-chip')).map((chip) => [
			chip.closest('.app-row')?.querySelector('.app-name')?.textContent?.trim(),
			chip.textContent?.trim()
		]);
		expect(chips).toEqual([['Ever Demand', 'APP_LAUNCHER.SOON']]);
	}));

	it('drops "Soon" once the deployment links Ever Demand', fakeAsync(() => {
		const fixture = setup({ environment: { EVER_APP_LINKS: 'demand=https://demand.deployment.test' } });
		const panel = open(fixture);
		expect(panel.querySelectorAll('a.app-row .app-chip')).toHaveLength(0);
	}));

	it("links each app at this deployment's address (EVER_APP_LINKS), Ever Tech included", fakeAsync(() => {
		const fixture = setup({
			environment: {
				EVER_APP_LINKS: 'platform=https://app-dev.platform.test,tech=https://tech.deployment.test',
				CLIENT_BASE_URL: 'https://gauzy.deployment.test'
			}
		});
		const panel = open(fixture);
		const hrefs = Array.from(panel.querySelectorAll<HTMLAnchorElement>('a.app-row')).map((link) =>
			link.getAttribute('href')
		);
		expect(hrefs[0]).toBe('https://app-dev.platform.test/');
		expect(hrefs[6]).toBe('https://tech.deployment.test/');
		// "+ Add" follows the Ever Platform of this deployment
		expect(hrefs[7]).toBe('https://app-dev.platform.test/apps?add=app');
	}));

	it('names "+ Add" for what it does, and links Ever Platform\'s page for adding apps', fakeAsync(() => {
		const fixture = setup();
		const panel = open(fixture);
		const add = panel.querySelector<HTMLAnchorElement>('a.app-row.add');
		expect(add?.getAttribute('href')).toBe('https://platform.catalog.test/apps?add=app');
		expect(add?.getAttribute('aria-label')).toBe('APP_LAUNCHER.ADD_HINT');
		expect(add?.getAttribute('title')).toBe('APP_LAUNCHER.ADD_HINT');
		expect(click(add as HTMLAnchorElement).followed).toBe(true);
	}));

	it('has no "+ Add" when the list has no Ever Platform', fakeAsync(() => {
		const fixture = setup({ apps: APPS.filter((listed) => listed.id !== 'platform') });
		const panel = open(fixture);
		expect(panel.querySelector('.app-add-item')).toBeNull();
		expect(panel.querySelectorAll('.app-switcher-list > li')).toHaveLength(7);
	}));

	it('shows nothing when the deployment links no other app', () => {
		const fixture = setup({ apps: [APPS[3]] });
		expect(fixture.nativeElement.hasAttribute('hidden')).toBe(true);
	});

	it('opens apps and "+ Add" in the system browser inside the desktop apps', fakeAsync(() => {
		const openExternal = jest.fn();
		const fixture = setup({ shell: { openExternal } });
		let panel = open(fixture);
		const works = panel.querySelectorAll<HTMLAnchorElement>('a.app-row')[1];
		expect(click(works).followed).toBe(false);
		expect(openExternal).toHaveBeenCalledWith('https://works.catalog.test');

		fixture.detectChanges();
		tick();
		panel = open(fixture);
		const add = panel.querySelector<HTMLAnchorElement>('a.app-row.add') as HTMLAnchorElement;
		expect(click(add).followed).toBe(false);
		expect(openExternal).toHaveBeenLastCalledWith('https://platform.catalog.test/apps?add=app');
	}));

	it('moves through the rows, "+ Add" included, with the arrow keys, and closes on Escape', fakeAsync(() => {
		const fixture = setup();
		const panel = open(fixture);
		const links = Array.from(panel.querySelectorAll<HTMLAnchorElement>('a.app-row'));
		const nav = panel as HTMLElement;
		// A press puts the focus on the first link
		expect(document.activeElement).toBe(links[0]);

		nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
		expect(document.activeElement).toBe(links[links.length - 1]);
		expect(document.activeElement?.classList).toContain('add');

		nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
		expect(document.activeElement).toBe(links[0]);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		fixture.detectChanges();
		tick();
		expect(document.getElementById(fixture.componentInstance.panelId)).toBeNull();
		expect(document.activeElement).toBe(trigger(fixture));
	}));

	it('names its button and the list', fakeAsync(() => {
		const fixture = setup();
		expect(trigger(fixture).getAttribute('aria-label')).toBe('HEADER.SWITCH_EVER_APP');
		const panel = open(fixture);
		const title = document.getElementById(panel.getAttribute('aria-labelledby') ?? '');
		expect(title?.textContent?.trim()).toBe('HEADER.EVER_APPS');
		expect(trigger(fixture).getAttribute('aria-expanded')).toBe('true');
	}));
});
