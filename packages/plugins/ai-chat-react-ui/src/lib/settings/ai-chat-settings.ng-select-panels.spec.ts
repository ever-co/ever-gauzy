import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ng-select 21 -> 24 (2026-10 dependency upgrade) renders every dropdown panel in a CDK overlay. Without
 * `appendTo` that overlay is Nebular's container inside <nb-layout>, which `NgSelectPanelSizingService`
 * (ui-core) does not watch, so the pane never gets its "never narrower than the select" floor and the
 * global panel rule sizes it to its content: the default-model select, which virtual-scrolls (rows
 * absolutely positioned, so no content width), opened a sliver about 11px wide. Every select on this
 * page appends to <body>, as the rest of the app's selects do.
 */
describe('AI chat settings: model select panels', () => {
	const template = readFileSync(join(__dirname, 'ai-chat-settings.component.html'), 'utf8');
	const selects = template.match(/<ng-select\b[^>]*>/g) ?? [];

	it('finds the model selects in the template', () => {
		expect(selects.length).toBeGreaterThanOrEqual(2);
	});

	it('appends every select panel to <body>, where the sizing service gives it the select width as a floor', () => {
		const withoutBody = selects.filter((tag) => !/\sappendTo="body"/.test(tag));

		expect(withoutBody).toEqual([]);
	});
});
