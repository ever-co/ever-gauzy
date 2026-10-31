import { CsvReportExporter } from './csv-report-exporter';
import { IReportExportTable } from './report-export.model';

interface IRow {
	name: string;
	hours: number;
	note?: string | null;
}

const table: IReportExportTable<IRow> = {
	columns: [
		{ key: 'name', header: 'Name', value: (row) => row.name },
		{ key: 'hours', header: 'Hours', value: (row) => row.hours },
		{ key: 'note', header: 'Note', value: (row) => row.note }
	],
	rows: [
		{ name: 'Ada Lovelace', hours: 1.5, note: 'Reviewed "spec", then shipped' },
		{ name: '=cmd|" /C calc"!A0', hours: 0, note: null }
	]
};

/** Reads a blob as text (UTF-8, byte order mark dropped) or as its raw bytes. */
function readBlob(blob: Blob, as: 'text'): Promise<string>;
function readBlob(blob: Blob, as: 'bytes'): Promise<Uint8Array>;
function readBlob(blob: Blob, as: 'text' | 'bytes'): Promise<string | Uint8Array> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () =>
			resolve(as === 'text' ? (reader.result as string) : new Uint8Array(reader.result as ArrayBuffer));
		reader.onerror = () => reject(reader.error);
		if (as === 'text') {
			reader.readAsText(blob);
		} else {
			reader.readAsArrayBuffer(blob);
		}
	});
}

describe('CsvReportExporter', () => {
	const exporter = new CsvReportExporter();

	it('is the csv format', () => {
		expect(exporter.format).toBe('csv');
		expect(exporter.extension).toBe('csv');
	});

	it('writes a header record, then one record per row, in column order', () => {
		expect(exporter.toCsv(table).split('\r\n')).toEqual([
			'"Name","Hours","Note"',
			'"Ada Lovelace",1.5,"Reviewed ""spec"", then shipped"',
			// The formula is neutralized, the number stays bare and the missing note is an empty field
			`"'=cmd|"" /C calc""!A0",0,`
		]);
	});

	it('neutralizes a header too', () => {
		const csv = exporter.toCsv({ columns: [{ key: 'x', header: '@x', value: () => 1 }], rows: [] });

		expect(csv).toBe(`"'@x"`);
	});

	it('writes only the header for a table without rows', () => {
		expect(exporter.toCsv({ ...table, rows: [] })).toBe('"Name","Hours","Note"');
	});

	it('makes a UTF-8 CSV file with a byte order mark, for Excel', async () => {
		const blob = exporter.toBlob(table);

		expect(blob.type).toBe('text/csv;charset=utf-8');
		// The file starts with the UTF-8 encoding of U+FEFF…
		const bytes = await readBlob(blob, 'bytes');
		expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
		// …which a UTF-8 reader drops, leaving the CSV text
		expect(await readBlob(blob, 'text')).toBe(exporter.toCsv(table));
	});
});
