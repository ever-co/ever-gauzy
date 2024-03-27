/**
 * DigitalOcean Spaces Configuration
 */
export interface IDigitalOceanConfig {
    /** DigitalOcean Access Key ID */
    readonly accessKeyId: string;
    /** DigitalOcean Secret Access Key */
    readonly secretAccessKey: string;
    /** DigitalOcean Region */
    readonly region: string;
    /** DigitalOcean Service URL */
    readonly serviceUrl: string;
    /** The CDN (Content Delivery Network) DigitalOcean configuration. */
    readonly cdnUrl?: string;
    /** S3 Bucket Configuration */
    readonly s3: {
        /** S3 Bucket Name */
        readonly bucket: string;
        readonly forcePathStyle: boolean;
    };
}
