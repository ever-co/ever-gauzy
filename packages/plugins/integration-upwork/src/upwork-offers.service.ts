import { Injectable, BadRequestException } from '@nestjs/common';
import * as UpworkApi from 'upwork-api';
import { Offers } from 'upwork-api/lib/routers/hr/freelancers/offers.js';
import { Applications } from 'upwork-api/lib/routers/hr/freelancers/applications.js';
import {
	IUpworkApiConfig,
	IUpworkProposalStatusEnum,
	IUpworkOfferStatusEnum
} from '@gauzy/contracts';

@Injectable()
export class UpworkOffersService {
	constructor() {}

	/**
	 * List freelancer’s offers
	 * This call retrieves a list of offers received by a freelancer.
	 */
	public async getOffersListByFreelancer(
		config: IUpworkApiConfig,
		status: IUpworkOfferStatusEnum
	): Promise<any> {
		try {
			const api = new UpworkApi(config);
			const offers = new Offers(api);
			const params = {
				status,
				offset: 0
			};

			return new Promise((resolve, reject) => {
				api.setAccessToken(
					config.accessToken,
					config.accessSecret,
					() => {
						offers.getList(params, (err, data) =>
							err ? reject(err) : resolve(data)
						);
					}
				);
			});
		} catch (error) {
			throw new BadRequestException('Cannot get offers list');
		}
	}

	/**
	 * Get freelancer’s offer
	 * This call retrieves details about a specific offer received by a freelancer.
	 */
	public async getOfferByKey(
		config: IUpworkApiConfig,
		offerKey: string
	): Promise<any> {
		try {
			const api = new UpworkApi(config);
			const offers = new Offers(api);

			return new Promise((resolve, reject) => {
				api.setAccessToken(
					config.accessToken,
					config.accessSecret,
					() => {
						offers.getSpecific(offerKey, (err, data) =>
							err ? reject(err) : resolve(data)
						);
					}
				);
			});
		} catch (error) {
			throw new BadRequestException('Cannot get freelancer offers');
		}
	}

	/**
	 * List job applications as freelancer
	 * This call lists all job applications made by a freelancer.
	 */
	public async getProposalLisByFreelancer(
		config: IUpworkApiConfig,
		status: IUpworkProposalStatusEnum
	): Promise<any> {
		try {
			const api = new UpworkApi(config);
			const applications = new Applications(api);
			const params = {
				status,
				offset: 0
			};

			return new Promise((resolve, reject) => {
				api.setAccessToken(
					config.accessToken,
					config.accessSecret,
					() => {
						applications.getList(params, (err, data) =>
							err ? reject(err) : resolve(data)
						);
					}
				);
			});
		} catch (error) {
			throw new BadRequestException('Cannot get proposal list');
		}
	}

	/**
	 * Get job application as freelancer
	 * This call retrieves details about a specific job application made by a freelancer.
	 */
	public getProposalBykey(
		config: IUpworkApiConfig,
		applicationId: string
	): Promise<any> {
		try {
			const api = new UpworkApi(config);
			const applications = new Applications(api);

			return new Promise((resolve, reject) => {
				api.setAccessToken(
					config.accessToken,
					config.accessSecret,
					() => {
						applications.getSpecific(applicationId, (err, data) =>
							err ? reject(err) : resolve(data)
						);
					}
				);
			});
		} catch (error) {
			throw new BadRequestException(
				'Cannot get proposal by applicationId'
			);
		}
	}
}
