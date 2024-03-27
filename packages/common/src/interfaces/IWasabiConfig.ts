/**
 * Wasabi Configuration
 */
export interface IWasabiConfig {
	/** Wasabi Access Key ID */
	readonly accessKeyId: string;

	/** Wasabi Secret Access Key */
	readonly secretAccessKey: string;

	/** Wasabi Region */
	readonly region: string;

	/** Wasabi Service URL */
	readonly serviceUrl: string;

	/** S3 Bucket Configuration */
	readonly s3: {
		/** S3 Bucket Name */
		readonly bucket: string;
		readonly forcePathStyle: boolean;
	};
}
