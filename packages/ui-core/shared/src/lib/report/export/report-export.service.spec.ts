import { TestBed } from '@angular/core/testing';
import { saveAs } from 'file-saver';
import { IReportExporter, IReportExportTable, REPORT_EXPORTERS } from './report-export.model';
import { ReportExportService } from './report-export.service';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

const table: IReportExportTable<{ name: string }> = {
	columns: [{ key: 'name', header: 'Name', value: (row) => row.name }],
	rows: [{ name: 'Ada' }]
};

/** An exporter a plugin could register, writing plain text. */
class TextExporter implements IReportExporter {
	readonly format = 'txt';
	readonly extension = 'txt';
	readonly toBlob = jest.fn(() => new Blob(['text'], { type: 'text/plain' }));
}

describe('ReportExportService', () => {
	afterEach(() => {
		(saveAs as unknown as jest.Mock).mockReset();
		TestBed.resetTestingModule();
	});

	describe('with the built-in formats only', () => {
		let service: ReportExportService;

		beforeEach(() => {
			service = TestBed.inject(ReportExportService);
		});

		it('exports to CSV by default, under the file name with its extension', () => {
			service.export(table, { fileName: 'time-activity_2026-10-01_2026-10-31' });

			expect(saveAs).toHaveBeenCalledTimes(1);
			const [blob, fileName] = (saveAs as unknown as jest.Mock).mock.calls[0];
			expect(fileName).toBe('time-activity_2026-10-01_2026-10-31.csv');
			expect((blob as Blob).type).toBe('text/csv;charset=utf-8');
		});

		it('supports CSV', () => {
			expect(service.formats).toEqual(['csv']);
			expect(service.supports('csv')).toBe(true);
			expect(service.supports('pdf')).toBe(false);
		});

		it('refuses a format nobody registered, without downloading anything', () => {
			expect(() => service.export(table, { fileName: 'report', format: 'pdf' })).toThrow(/"pdf"/);
			expect(saveAs).not.toHaveBeenCalled();
		});
	});

	describe('with an exporter a plugin registers', () => {
		let service: ReportExportService;
		let text: TextExporter;

		beforeEach(() => {
			text = new TextExporter();
			TestBed.configureTestingModule({
				providers: [{ provide: REPORT_EXPORTERS, useValue: text, multi: true }]
			});
			service = TestBed.inject(ReportExportService);
		});

		it('offers the plugin format beside CSV', () => {
			expect(service.formats).toEqual(['csv', 'txt']);
		});

		it('exports through the plugin exporter when its format is asked for', () => {
			service.export(table, { fileName: 'report', format: 'txt' });

			expect(text.toBlob).toHaveBeenCalledWith(table);
			expect((saveAs as unknown as jest.Mock).mock.calls[0][1]).toBe('report.txt');
		});
	});
});
