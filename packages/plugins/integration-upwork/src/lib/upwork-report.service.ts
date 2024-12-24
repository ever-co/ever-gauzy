import { Injectable, BadRequestException } from '@nestjs/common';
import * as moment from 'moment';
import * as UpworkApi from 'upwork-api';
import { Billings } from 'upwork-api/lib/routers/reports/finance/billings.js';
import { Earnings } from 'upwork-api/lib/routers/reports/finance/earnings.js';
import { Time } from 'upwork-api/lib/routers/reports/time.js';
import { IUpworkApiConfig, IUpworkDateRange } from '@gauzy/contracts';

const DEFAULT_DATE_RANGE = {
	start: moment().quarter(moment().quarter()).startOf('quarter').format('YYYY-MM-DD'),
	end: moment().quarter(moment().quarter()).endOf('quarter').format('YYYY-MM-DD')
};

@Injectable()
export class UpworkReportService {
	/**
	 * Fetches detailed time reports for a specific freelancer.
	 *
	 * @param {IUpworkApiConfig} config - Configuration object for Upwork API, including access tokens and API keys.
	 * @param {string} providerId - The ID of the freelancer for whom the report is being fetched.
	 * @param {IUpworkDateRange} dateRange - The start and end dates for the report.
	 * @returns {Promise<any>} - Returns the time report data or throws an exception if an error occurs.
	 * @throws {BadRequestException} - Thrown if the report cannot be fetched.
	 */
	public async getFullReportByFreelancer(
		config: IUpworkApiConfig,
		providerId: string,
		dateRange: IUpworkDateRange
	): Promise<any> {
		const api = new UpworkApi(config);
		const reports = new Time(api);
		const { start, end } = dateRange;

		const selectQuery = `
			SELECT
				worked_on,
				company_id,
				company_name,
				assignment_name,
				assignment_team_id,
				assignment_ref,
				assignment_rate,
				hours,
				memo,
				contract_type
			WHERE
				worked_on > '${start || DEFAULT_DATE_RANGE.start}' AND
				worked_on <= '${end || DEFAULT_DATE_RANGE.end}'
			ORDER BY
				worked_on,
				assignment_ref
		`;

		try {
			return new Promise((resolve, reject) => {
				api.setAccessToken(config.accessToken, config.accessSecret, () => {
					reports.getByFreelancerFull(
						providerId,
						{ tq: selectQuery },
						(error: any, data: any) => (error ? reject(error) : resolve(data))
					);
				});
			});
		} catch (error) {
			throw new BadRequestException('Cannot get freelancer income report');
		}
	}

	/**
	 * Fetches limited time reports (hours only) for a specific freelancer.
	 *
	 * @param {IUpworkApiConfig} config - Configuration object for Upwork API, including access tokens and API keys.
	 * @param {string} providerId - The ID of the freelancer for whom the report is being fetched.
	 * @param {IUpworkDateRange} dateRange - The start and end dates for the report.
	 * @returns {Promise<any>} - Returns the time report data or throws an exception if an error occurs.
	 * @throws {BadRequestException} - Thrown if the report cannot be fetched.
	 */
	public async getLimitedReportByFreelance(
		config: IUpworkApiConfig,
		providerId: string,
		dateRange: IUpworkDateRange
	): Promise<any> {
		const api = new UpworkApi(config);
		const reports = new Time(api);
		const { start, end } = dateRange;

		const selectQuery = `
			SELECT
				worked_on,
				company_id,
				company_name,
				assignment_name,
				assignment_team_id,
				assignment_ref,
				assignment_rate,
				hours,
				memo,
				contract_type
			WHERE
				worked_on > '${start || DEFAULT_DATE_RANGE.start}' AND
				worked_on <= '${end || DEFAULT_DATE_RANGE.end}'
			ORDER BY
				worked_on,
				assignment_ref
		`;

		try {
			return new Promise((resolve, reject) => {
				api.setAccessToken(config.accessToken, config.accessSecret, () => {
					reports.getByFreelancerLimited(
						providerId,
						{ tq: selectQuery },
						(error: any, data: any) => (error ? reject(error) : resolve(data))
					);
				});
			});
		} catch (error) {
			throw new BadRequestException('Cannot get freelancer limited time report');
		}
	}

	/**
	 * Fetches billing reports for a freelancer.
	 *
	 * @param {IUpworkApiConfig} config - Configuration object for Upwork API, including access tokens and API keys.
	 * @param {string} providerReferenceId - The reference ID of the freelancer for whom the billing report is being fetched.
	 * @param {IUpworkDateRange} dateRange - The start and end dates for the report.
	 * @returns {Promise<any>} - Returns the billing report data or throws an exception if an error occurs.
	 * @throws {BadRequestException} - Thrown if the billing report cannot be fetched.
	 */
	public async getBillingReportByFreelancer(
		config: IUpworkApiConfig,
		providerReferenceId: string,
		dateRange: IUpworkDateRange
	): Promise<any> {
		const api = new UpworkApi(config);
		const billings = new Billings(api);
		const { start, end } = dateRange;

		const query = `
			SELECT
				amount,
				date,
				type,
				subtype
			WHERE
				date > '${start || DEFAULT_DATE_RANGE.start}' AND
				date <= '${end || DEFAULT_DATE_RANGE.end}'
		`;

		try {
			return new Promise((resolve, reject) => {
				api.setAccessToken(config.accessToken, config.accessSecret, () => {
					billings.getByFreelancer(
						providerReferenceId,
						{ tq: query },
						(error: any, data: any) => (error ? reject(error) : resolve(data))
					);
				});
			});
		} catch (error) {
			throw new BadRequestException('Cannot get freelancer billing report');
		}
	}

	/**
	 * Fetches earning reports for a freelancer.
	 *
	 * @param {IUpworkApiConfig} config - Configuration object for the Upwork API, including API keys and tokens.
	 * @param {string} providerReferenceId - The reference ID of the freelancer for whom the earning report is being fetched.
	 * @param {IUpworkDateRange} dateRange - The start and end dates for the report.
	 * @returns {Promise<any>} - Returns the earning report data or throws an exception if an error occurs.
	 * @throws {BadRequestException} - Thrown if the earning report cannot be fetched.
	 */
	public async getEarningReportByFreelancer(
		config: IUpworkApiConfig,
		providerReferenceId: string,
		dateRange: IUpworkDateRange
	): Promise<any> {
		const api = new UpworkApi(config);
		const earnings = new Earnings(api);
		const { start, end } = dateRange;

		const query = `
			SELECT
				amount,
				date,
				type,
				subtype,
				description,
				assignment_name,
				assignment__reference,
				provider__reference,
				reference
			WHERE
				date > '${start || DEFAULT_DATE_RANGE.start}' AND
				date <= '${end || DEFAULT_DATE_RANGE.end}'
		`;

		try {
			return new Promise((resolve, reject) => {
				api.setAccessToken(config.accessToken, config.accessSecret, () => {
					earnings.getByFreelancer(
						providerReferenceId,
						{ tq: query },
						(error: any, data: any) => (error ? reject(error) : resolve(data))
					);
				});
			});
		} catch (error) {
			throw new BadRequestException('Cannot get freelancer earning report');
		}
	}
}
