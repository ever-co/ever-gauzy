import { IErrorReportRepository } from "./i-error-report-repository";

export interface IErrorReport {
	title: string;
	description: string;
	repository: IErrorReportRepository;
	submit(): Promise<void>;
}
