import { exec } from 'child_process';

interface ICurlCommandResponse<T> {
	stdout: T;
	stderr: string;
}

export class FetchCommand {
	constructor(private readonly url: string | URL) {}

	public execute<T>(): Promise<ICurlCommandResponse<T>> {
		const command = `curl -H 'Content-Type: application/json' ${this.url}`;
		return new Promise((resolve, reject) => {
			exec(command, (error, stdout, stderr) => {
				if (error) {
					reject(`exec error: ${error}`);
					return;
				}
				resolve({ stdout: JSON.parse(stdout), stderr });
			});
		});
	}
}
