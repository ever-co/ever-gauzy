export interface AWSConfig {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	s3: {
		bucket: string;
	};
}
