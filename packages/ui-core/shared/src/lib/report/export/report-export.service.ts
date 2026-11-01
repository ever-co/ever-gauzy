import { inject, Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import { CsvReportExporter } from './csv-report-exporter';
import {
	IReportExporter,
	IReportExportOptions,
	IReportExportTable,
	REPORT_EXPORTERS,
	ReportExportFormatEnum
} from './report-export.model';

/**
 * Exports report tables to files in the browser.
 *
 * CSV is built in. More formats plug in through the `REPORT_EXPORTERS` multi-provider, so a report asks for
 * a format by name and never depends on how that format is written.
 */
@Injectable({ providedIn: 'root' })
export class ReportExportService {
	private readonly exporters = new Map<string, IReportExporter>();

	constructor() {
		const registered = inject(REPORT_EXPORTERS, { optional: true }) ?? [];
		for (const exporter of [new CsvReportExporter(), ...registered]) {
			this.exporters.set(exporter.format, exporter);
		}
	}

	/** The formats a report can be exported to. */
	get formats(): string[] {
		return [...this.exporters.keys()];
	}

	/**
	 * Whether a format can be exported to.
	 *
	 * @param format - The format identifier, e.g. `csv`.
	 */
	supports(format: string): boolean {
		return this.exporters.has(format);
	}

	/**
	 * Encodes a report table in the requested format and hands the file to the browser as a download.
	 *
	 * @param table - The report table.
	 * @param options - The file name (without extension) and the format, CSV by default.
	 * @throws Error when no exporter is registered for the format.
	 */
	export<TRow>(table: IReportExportTable<TRow>, options: IReportExportOptions): void {
		const format = options.format ?? ReportExportFormatEnum.CSV;
		const exporter = this.exporters.get(format);
		if (!exporter) {
			throw new Error(`No report exporter is registered for the "${format}" format.`);
		}
		saveAs(exporter.toBlob(table), `${options.fileName}.${exporter.extension}`);
	}
}
