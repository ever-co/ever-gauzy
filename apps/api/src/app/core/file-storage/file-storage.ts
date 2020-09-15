import { FileStorageOption, FileSystemProvider, ProviderEnum } from './models';
import * as Providers from './providers';
import { environment } from '@env-api/environment';

export class FileStorage {
	providers: { [key: string]: FileSystemProvider } = {};
	config: FileStorageOption = {
		dest: ''
	};

	constructor(option?: FileStorageOption) {
		this.initProvider();
		this.setConfig(option);
	}

	setConfig(config: Partial<FileStorageOption> = {}) {
		this.config = {
			...this.config,
			...config,
			provider: (config.provider ||
				environment.fileSystem.name) as ProviderEnum
		};
		return this;
	}

	provider(providerName: ProviderEnum) {
		this.config.provider = providerName;
		return this;
	}

	url(filePath: string) {
		const instance = this.getProviderInstance();
		return instance.url(filePath);
	}

	path(filePath: string) {
		const instance = this.getProviderInstance();
		return instance.path(filePath);
	}

	storage(option?: FileStorageOption) {
		let resp: any;
		this.setConfig(option);
		if (this.config.provider && this.providers[this.config.provider]) {
			resp = this.providers[this.config.provider].handler(this.config);
		} else {
			throw new Error(`Provider "${this.config.provider}" is not valid.`);
		}
		return resp;
	}

	getProviderInstance(): FileSystemProvider {
		return this.providers[this.config.provider].getInstance();
	}

	initProvider() {
		for (const key in Providers) {
			if (Object.prototype.hasOwnProperty.call(Providers, key)) {
				const className = Providers[key];
				if (className.instance === undefined) {
					const provider: FileSystemProvider = new className();
					this.providers[provider.name] = provider;

					className.instance = provider;
				} else {
					this.providers[className.instance.name] =
						className.instance;
				}
			}
		}
	}
}
