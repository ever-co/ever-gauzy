export interface IDownloadStrategy {
	download(imageUrl: string, destination?: string): Promise<string> | string;
}
