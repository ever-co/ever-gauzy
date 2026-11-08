import { ElementRef, Renderer2, RendererFactory2 } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { NEVER } from 'rxjs';
import { ITag } from '@gauzy/contracts';
import { Store, TagsService } from '@gauzy/ui-core/core';
import { TagsColorInputComponent } from './tags-color-input.component';

/*
 * Built by hand against a small DOM: what is under test is how the selector measures the chips it shows, not its
 * template (Nebular, ng-select and the translate pipe), so the host only carries the value container it measures.
 */
describe('TagsColorInputComponent — measuring the selected tags', () => {
	let host: HTMLElement;
	let renderer: Renderer2;
	let appended: HTMLElement[];
	let component: TagsColorInputComponent;

	beforeEach(() => {
		host = document.createElement('div');
		const container = host.appendChild(document.createElement('div'));
		container.className = 'ng-value-container';
		// jsdom lays nothing out (every width reads 0): a wide row, so every selected tag is measured.
		Object.defineProperty(container, 'offsetWidth', { value: 10_000 });
		document.body.appendChild(host);

		renderer = TestBed.inject(RendererFactory2).createRenderer(null, null);
		appended = [];
		const appendChild = renderer.appendChild.bind(renderer);
		jest.spyOn(renderer, 'appendChild').mockImplementation((parent: unknown, child: HTMLElement) => {
			appended.push(child);
			appendChild(parent, child);
		});

		// Its signal input is created as it is constructed, which needs an injection context.
		component = TestBed.runInInjectionContext(
			() =>
				new TagsColorInputComponent(
					{} as TagsService,
					{} as Store,
					{ getJsTheme: () => NEVER } as unknown as NbThemeService,
					TestBed.inject(TranslateService),
					new ElementRef(host),
					renderer
				)
		);
	});

	afterEach(() => {
		host.remove();
		jest.restoreAllMocks();
	});

	it('puts a tag name in the measuring badge as text, never as HTML (CodeQL js/xss-through-dom)', () => {
		const name = '<img src="x" onerror="window.__tagXss = 1"><b>bold</b> & co';
		component.selectedTags = [{ name } as ITag];

		component.onResize();

		const badges = appended.filter((element) => element.tagName.toLowerCase() === 'nb-badge');
		expect(badges).toHaveLength(1);
		// The name as typed, and no element parsed out of it: nothing a member typed becomes markup on the page.
		expect(badges[0].textContent).toBe(name);
		expect(badges[0].childElementCount).toBe(0);
		expect(badges[0].querySelector('img')).toBeNull();
	});

	it('measures an ordinary name as the same text', () => {
		component.selectedTags = [{ name: 'Urgent' } as ITag, { name: 'Q4 – Sales' } as ITag];

		component.onResize();

		expect(
			appended.filter((element) => element.tagName.toLowerCase() === 'nb-badge').map((badge) => badge.textContent)
		).toEqual(['Urgent', 'Q4 – Sales']);
	});
});
