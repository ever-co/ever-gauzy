import { Injectable, BadRequestException } from '@nestjs/common';
import * as moment from 'moment';
import * as UpworkApi from 'upwork-api';
import { Billings } from 'upwork-api/lib/routers/reports/finance/billings.js';
import { Earnings } from 'upwork-api/lib/routers/reports/finance/earnings.js';
import { Time } from 'upwork-api/lib/routers/reports/time.js';
import { IUpworkApiConfig, IUpworkDateRange } from '@gauzy/models';

const DEFAULT_DATE_RANGE = {
	start: moment().subtract(1, 'months').startOf('month').format('YYYY-MM-DD'),
	end: moment().subtract(1, 'months').endOf('month').format('YYYY-MM-DD')
};

@Injectable()
export class UpworkReportService {
	constructor() {}

	/*
	 * Get freelancer specific time reports
	 * Description : This call allows callers to generate time reports for themselves, including monetary information. The caller must be the freelancer himself.
	 */
	public async getFullReportByFreelancer(
		config: IUpworkApiConfig,
		providerId,
		dateRange: IUpworkDateRange
	): Promise<any> {
		try {
			const api = new UpworkApi(config);
			const reports = new Time(api);
			const { start, end } = dateRange;

			const select = `SELECT 
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
							assignment_ref`;

			return new Promise((resolve, reject) => {
				api.setAccessToken(
					config.accessToken,
					config.accessSecret,
					() => {
						reports.getByFreelancerFull(
							providerId,
							{
								tq: select
							},
							(err, data) => (err ? reject(err) : resolve(data))
						);
					}
				);
			});
		} catch {
			throw new BadRequestException(
				'Cannot get freelancer income report'
			);
		}
	}

	/*
	 * Get freelancer specific time reports (hours only)
	 * Description : This call allows callers to generate time reports for themselves. No monetary fields, such as charges, are supported. The caller must be the freelancer himself.
	 */
	public async getLimitedReportByFreelance(
		config: IUpworkApiConfig,
		providerId,
		dateRange: IUpworkDateRange
	): Promise<any> {
		try {
			const api = new UpworkApi(config);
			const reports = new Time(api);
			const { start, end } = dateRange;

			const select = `SELECT 
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
							assignment_ref`;

			return new Promise((resolve, reject) => {
				api.setAccessToken(
					config.accessToken,
					config.accessSecret,
					() => {
						reports.getByFreelancerLimited(
							providerId,
							{
								tq: select
							},
							(err, data) => (err ? reject(err) : resolve(data))
						);
					}
				);
			});
		} catch (error) {
			throw new BadRequestException(
				'Cannot get freelancer income report'
			);
		}
	}

	/*
	 * Get billing reports for a freelancer
	 * Description: This call allows freelancers to find out what clients are paying for their services.
	 */
	public async getBillingReportByFreelancer(
		config: IUpworkApiConfig,
		providerRefernceId,
		dateRange: IUpworkDateRange
	) {
		try {
			const api = new UpworkApi(config);
			const billings = new Billings(api);
			const { start, end } = dateRange;

			const select = `SELECT 
								amount,
								date,
								type,
								subtype
							WHERE 
								date > '${start || DEFAULT_DATE_RANGE.start}' AND 
								date <= '${end || DEFAULT_DATE_RANGE.end}'`;

			return new Promise((resolve, reject) => {
				api.setAccessToken(
					config.accessToken,
					config.accessSecret,
					() => {
						billings.getByFreelancer(
							providerRefernceId,
							{
								tq: select
							},
							(err, data) => (err ? reject(err) : resolve(data))
						);
					}
				);
			});
		} catch (error) {
			throw new BadRequestException(
				'Cannot get freelancer billing report'
			);
		}
	}

	/*
	 * Get earning reports for a freelancer
	 * Description: This call allows freelancers to find out what they are being paid for their services.
	 */
	public async getEarningReportByFreelancer(
		config: IUpworkApiConfig,
		providerRefernceId,
		dateRange: IUpworkDateRange
	): Promise<any> {
		try {
			const api = new UpworkApi(config);
			const earnings = new Earnings(api);
			const { start, end } = dateRange;

			const select = `SELECT 
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
								date <= '${end || DEFAULT_DATE_RANGE.end}'`;

			return new Promise((resolve, reject) => {
				api.setAccessToken(
					config.accessToken,
					config.accessSecret,
					() => {
						earnings.getByFreelancer(
							providerRefernceId,
							{
								tq: select
							},
							(err, data) => (err ? reject(err) : resolve(data))
						);
					}
				);
			});
		} catch (error) {
			throw new BadRequestException(
				'Cannot get freelancer earning report'
			);
		}
	}
}
