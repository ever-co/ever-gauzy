import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbTooltipModule } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EVER_APPS, IEverApp } from '@gauzy/ui-core/common';
import { ElectronService } from '@gauzy/ui-core/core';
import { GAUZY_ENV } from '@gauzy/ui-config';
import { AppRailComponent } from './app-rail.component';

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

function setup(
	options: { apps?: ReadonlyArray<IEverApp>; shell?: { openExternal: jest.Mock } } = {}
): ComponentFixture<AppRailComponent> {
	const providers: unknown[] = [
		{ provide: EVER_APPS, useValue: options.apps ?? APPS },
		{ provide: GAUZY_ENV, useValue: {} }
	];
	if (options.shell) {
		providers.push({ provide: ElectronService, useValue: { shell: options.shell } });
	}
	TestBed.configureTestingModule({
		declarations: [AppRailComponent],
		imports: [NbTooltipModule],
		providers: providers as never[]
	});
	const fixture = TestBed.createComponent(AppRailComponent);
	fixture.detectChanges();
	return fixture;
}

function clickFollows(link: HTMLElement): boolean {
	let followed = true;
	document.addEventListener(
		'click',
		(seen) => {
			followed = !seen.defaultPrevented;
			seen.preventDefault();
		},
		{ once: true }
	);
	link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
	return followed;
}

describe('AppRailComponent (the App Launcher as a rail)', () => {
	it('shows one slot per Ever app, then "+" last', () => {
		const items = Array.from((setup().nativeElement as HTMLElement).querySelectorAll('.app-rail-item'));
		expect(items).toHaveLength(9);
		expect(items[8].classList).toContain('app-rail-add');
		expect(items[8].querySelector('a')?.getAttribute('href')).toBe('https://platform.catalog.test/apps?add=app');
		expect(items[8].querySelector('a')?.getAttribute('aria-label')).toBe('APP_LAUNCHER.ADD_HINT');
	});

	it('opens the other apps in the same tab: plain links, no target, no rel', () => {
		const root: HTMLElement = setup().nativeElement;
		const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a.app-rail-slot'));
		expect(links).toHaveLength(8);
		for (const link of links) {
			expect(link.hasAttribute('target')).toBe(false);
			expect(link.hasAttribute('rel')).toBe(false);
		}
		expect(clickFollows(links[1])).toBe(true);
	});

	it('names each app in full, with no "new tab"; the current one is not a link', () => {
		const fixture = setup();
		const translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', {
			APP_LAUNCHER: { OPEN_APP: 'Open {{ app }}', CURRENT_APP: "{{ app }}, you're here", SOON: 'Soon' }
		});
		translate.use('en');
		fixture.detectChanges();
		const root: HTMLElement = fixture.nativeElement;
		const labels = Array.from(root.querySelectorAll('a.app-rail-slot'))
			.slice(0, 7)
			.map((link) => link.getAttribute('aria-label'));
		expect(labels).toEqual([
			'Open Ever Platform',
			'Open Ever Works',
			'Open Ever Teams',
			'Open Ever Rec',
			'Open Ever Traduora',
			'Open Ever Demand · Soon',
			'Open Ever Tech'
		]);
		const current = root.querySelector('.app-rail-item.current .app-rail-slot');
		expect(current?.tagName).toBe('SPAN');
		expect(current?.getAttribute('aria-current')).toBe('page');
		expect(current?.getAttribute('aria-label')).toBe("Ever Gauzy, you're here");
	});

	it('has no "+" when the list has no Ever Platform', () => {
		const root: HTMLElement = setup({ apps: APPS.filter((listed) => listed.id !== 'platform') }).nativeElement;
		expect(root.querySelector('.app-rail-add')).toBeNull();
	});

	it('opens apps and "+" in the system browser inside the desktop apps', () => {
		const openExternal = jest.fn();
		const root: HTMLElement = setup({ shell: { openExternal } }).nativeElement;
		const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a.app-rail-slot'));
		expect(clickFollows(links[1])).toBe(false);
		expect(openExternal).toHaveBeenCalledWith('https://works.catalog.test');
		expect(clickFollows(links[links.length - 1])).toBe(false);
		expect(openExternal).toHaveBeenLastCalledWith('https://platform.catalog.test/apps?add=app');
	});
});
