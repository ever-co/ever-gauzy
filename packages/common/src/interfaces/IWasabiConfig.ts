export interface IWasabiConfig {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	serviceUrl: string;
	s3: {
		bucket: string;
	};
}