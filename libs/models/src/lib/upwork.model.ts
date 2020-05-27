export interface IAccessTokenDto {
	requestToken: string;
	requestTokenSecret?: string;
	verifier: string;
}

export interface IAccessToken {
	integrationId: string;
	accessToken: string;
	accessTokenSecret: string;
}

export interface IAccessTokenSecretPair {
	integrationId?: string;
	url: string;
	requestToken: string;
	requestTokenSecret?: string;
	accessTokenSecret?: string;
	accessToken?: string;
}

export interface IGetWorkDiaryDto {
	config: IUpworkApiConfig;
	contractId: string;
	forDate: Date;
}

export interface IGetContractsDto {
	config: IUpworkApiConfig;
}

export interface IEngagement {
	engagement_start_date: string;
	job_ref_ciphertext: string;
	status: string;
	provider__reference: string;
	engagement_job_type: string;
	offer_id: string;
	job__title: string;
	cj_job_application_uid: string;
	provider_team__id: string;
	fixed_charge_amount_agreed: string;
	job_application_ref: string;
	dev_recno_ciphertext: string;
	reference: string; // USED AS CONTRACT ID TO GET WORKDAYS
	active_milestone: string;
	engagement_end_ts: string;
	provider__id: string;
	created_time: string;
	engagement_end_date: string;
	provider_team__reference: string;
	engagement_start_ts: string;
	buyer_team__reference: string;
	fixed_price_upfront_payment: string;
}

export interface IUpworkApiConfig {
	consumerKey: string;
	consumerSecret: string;
	accessToken: string;
	accessSecret: string;
}
