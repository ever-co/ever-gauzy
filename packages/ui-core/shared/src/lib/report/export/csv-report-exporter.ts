import { buildCsvText, CSV_MIME_TYPE, CSV_UTF8_BOM } from '@gauzy/ui-core/common';
import { IReportExporter, IReportExportTable, ReportExportFormatEnum } from './report-export.model';

/**
 * Exports a report table as an RFC 4180 CSV file: a header record with the column titles, then one record
 * per row. Text cells are neutralized against formula injection and quoted; numbers stay bare so a
 * spreadsheet can sum them. The file is UTF-8 with a byte order mark, so Excel reads accented names
 * correctly.
 */
export class CsvReportExporter implements IReportExporter {
	readonly format = ReportExportFormatEnum.CSV;
	readonly extension = 'csv';

	/**
	 * The CSV text of a table, without the byte order mark.
	 *
	 * @param table - The report table.
	 * @returns The header record and one record per row, separated by CRLF.
	 */
	toCsv<TRow>(table: IReportExportTable<TRow>): string {
		const header = table.columns.map((column) => column.header);
		const records = table.rows.map((row) => table.columns.map((column) => column.value(row)));
		return buildCsvText([header, ...records]);
	}

	/**
	 * The CSV file of a table.
	 *
	 * @param table - The report table.
	 * @returns A UTF-8 CSV blob, byte order mark first.
	 */
	toBlob<TRow>(table: IReportExportTable<TRow>): Blob {
		return new Blob([CSV_UTF8_BOM + this.toCsv(table)], { type: CSV_MIME_TYPE });
	}
}
