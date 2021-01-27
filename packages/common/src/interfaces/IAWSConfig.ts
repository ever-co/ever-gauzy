export interface IAWSConfig {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	s3: {
		bucket: string;
	};
}
