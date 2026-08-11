import { readFileSync } from 'fs';
import { join } from 'path';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { NameCellComponent } from './name-cell.component';

/**
 * The name column's leading slot: the generated thumbnail when there is one, the kind icon
 * otherwise. `NameCellComponent` is a plain class (no `TranslationBaseComponent`), so it is
 * constructed directly — `TestBed` is unusable in this package (see
 * `editor/read-only/markdown-render.util.spec.ts`).
 *
 * The invariant that matters in a table is that the slot is a FIXED-size box whatever it
 * holds: rows must not change height, and the name column must not shift sideways, when a
 * thumbnail appears on a later processing poll or fails to load.
 */

function row(overrides: Partial<IDocument> = {}): IDocument & { isArchived?: boolean } {
	return {
		id: 'dddddddd-1111-4111-8111-111111111111' as ID,
		name: 'Quarterly report.pdf',
		kind: DocumentKindEnum.FILE,
		mimeType: 'application/pdf',
		...overrides
	} as IDocument;
}

function cell(rowData: IDocument & { isArchived?: boolean }): NameCellComponent {
	const component = new NameCellComponent();
	component.rowData = rowData;
	return component;
}

describe('name cell thumbnails', () => {
	it('shows the kind icon while the document has no thumbnail — the common case', () => {
		const component = cell(row());

		expect(component.thumbnailUrl).toBeNull();
		expect(component.icon).toBe('file-text-outline');
	});

	it('shows the thumbnail once the job has produced one', () => {
		const component = cell(row({ thumbUrl: 'https://cdn.example.com/thumbs/abc.png' } as Partial<IDocument>));

		expect(component.thumbnailUrl).toBe('https://cdn.example.com/thumbs/abc.png');
	});

	it('falls back to the icon when the image fails to load', () => {
		const component = cell(row({ thumbUrl: 'https://cdn.example.com/thumbs/gone.png' } as Partial<IDocument>));

		component.onThumbnailError();

		expect(component.thumbnailUrl).toBeNull();
		expect(component.icon).toBe('file-text-outline');
	});

	it('never binds a URL scheme Angular would let through', () => {
		expect(cell(row({ thumbUrl: 'javascript:alert(1)' } as Partial<IDocument>)).thumbnailUrl).toBeNull();
		expect(
			cell(row({ thumbUrl: 'data:text/html;base64,PHNjcmlwdD4=' } as Partial<IDocument>)).thumbnailUrl
		).toBeNull();
	});

	it('survives a row that has not been bound yet (the cell renders before init)', () => {
		const component = new NameCellComponent();

		expect(component.thumbnailUrl).toBeNull();
		expect(component.icon).toBe('file-outline');
	});

	describe('layout stability', () => {
		const source = readFileSync(join(__dirname, 'name-cell.component.ts'), 'utf8');

		it('keeps the leading slot at a fixed size whatever it holds', () => {
			const rule = /\.docs-name-lead\s*\{([^}]*)\}/.exec(source);

			expect(rule?.[1]).toMatch(/width:\s*[\d.]+rem/);
			expect(rule?.[1]).toMatch(/height:\s*[\d.]+rem/);
		});

		it('binds the sanitizing accessor rather than the raw column', () => {
			expect(source).toContain('*ngIf="thumbnailUrl as thumbnail; else leadIcon"');
			expect(source).not.toContain('[src]="rowData.thumbUrl"');
		});
	});
});
