export interface ISoundshot {
	name: string;
	recordedAt?: Date;
	channels?: number;
	fullUrl?: string;
	size?: number;
	rate?: number;
	duration?: number;
}
