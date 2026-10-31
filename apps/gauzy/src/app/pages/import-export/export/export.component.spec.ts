import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ExportComponent } from './export.component';

/**
 * #10184: the API registers `payroll_run` and `payroll_item` for export, but this page sends the server only the
 * tables it lists (`GET /export/filter`), so a table missing here is never in the archive, even with
 * "All entities" ticked.
 */
describe('ExportComponent — payroll', () => {
	const I18N_DIR = join(__dirname, '../../../../../../../packages/ui-core/i18n/assets/i18n');

	/** The page with its tables built and every label read back as its key, then "All entities" ticked, as on load. */
	const page = (): ExportComponent => {
		const component = Object.create(ExportComponent.prototype) as ExportComponent;
		(component as any).translateService = { instant: (key: string) => key };
		component.getEntities();
		component.onCheckboxChangeAll(true);
		return component;
	};

	it('offers payroll runs with their lines, selected by default', () => {
		const component = page();

		const payroll = component.entities.find((entity) => entity.value === 'payroll_run');

		expect(payroll).toMatchObject({ name: 'MENU.IMPORT_EXPORT.PAYROLL_RUN', isGroup: true, checked: true });
		expect(payroll.entities.map(({ name, value }) => ({ name, value }))).toEqual([
			{ name: 'MENU.IMPORT_EXPORT.PAYROLL_ITEM', value: 'payroll_item' }
		]);
		expect(component.selectedEntities).toEqual(expect.arrayContaining(['payroll_run', 'payroll_item']));
	});

	it('leaves payroll out when its group is unticked', () => {
		const component = page();
		const payroll = component.entities.find((entity) => entity.value === 'payroll_run');

		component.onCheckboxChange(false, payroll);

		expect(component.selectedEntities).not.toContain('payroll_run');
		expect(component.selectedEntities).not.toContain('payroll_item');
		// and the rest of the selection is untouched
		expect(component.selectedEntities).toContain('payment');
	});

	it('labels payroll in every language', () => {
		// The app's missing-translation handler shows the key itself, so a missing label fails nowhere else.
		const dictionaries = readdirSync(I18N_DIR).filter((file) => file.endsWith('.json'));
		expect(dictionaries.length).toBeGreaterThan(1);

		for (const file of dictionaries) {
			const labels = JSON.parse(readFileSync(join(I18N_DIR, file), 'utf8'))?.MENU?.IMPORT_EXPORT ?? {};
			for (const key of ['PAYROLL_RUN', 'PAYROLL_ITEM']) {
				expect({ file, key, label: typeof labels[key] === 'string' && labels[key].trim() !== '' }).toEqual({
					file,
					key,
					label: true
				});
			}
		}
	});
});
