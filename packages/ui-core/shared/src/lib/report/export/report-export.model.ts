import { InjectionToken } from '@angular/core';
import { CsvFieldValue } from '@gauzy/ui-core/common';

/** The value of one cell of an exported report. */
export type ReportExportCellValue = CsvFieldValue;

/** One column of an exported report: its title, and how its value is read from a row. */
export interface IReportExportColumn<TRow> {
	/** A stable identifier of the column (not written to the file), e.g. `date`. */
	readonly key: string;
	/** The column title written to the file, already translated. */
	readonly header: string;
	/** Reads the value of this column from a row. */
	readonly value: (row: TRow) => ReportExportCellValue;
}

/**
 * A report flattened into a table: what every export format writes.
 *
 * A report builds one from the rows it already shows, so an export never reads anything the page has
 * not already fetched under the caller's permissions.
 */
export interface IReportExportTable<TRow = unknown> {
	readonly columns: ReadonlyArray<IReportExportColumn<TRow>>;
	readonly rows: ReadonlyArray<TRow>;
}

/** The export formats the platform ships with. Plugins may register more through `REPORT_EXPORTERS`. */
export enum ReportExportFormatEnum {
	CSV = 'csv'
}

/** A file format a report table can be exported to. */
export interface IReportExporter {
	/** The format identifier a caller asks for, e.g. `csv`. */
	readonly format: string;
	/** The file extension, without the dot. */
	readonly extension: string;
	/** Encodes the table as a file. */
	toBlob<TRow>(table: IReportExportTable<TRow>): Blob;
}

/** How a report is exported. */
export interface IReportExportOptions {
	/** The file name, without the extension. */
	readonly fileName: string;
	/** The format to export to; CSV when not given. */
	readonly format?: string;
}

/**
 * Extra report export formats (PDF, XLSX…), added without touching the reports:
 *
 * ```ts
 * providers: [{ provide: REPORT_EXPORTERS, useClass: XlsxReportExporter, multi: true }]
 * ```
 *
 * CSV is built in; an exporter registered for a format that already exists replaces it.
 */
export const REPORT_EXPORTERS = new InjectionToken<IReportExporter[]>('REPORT_EXPORTERS');
