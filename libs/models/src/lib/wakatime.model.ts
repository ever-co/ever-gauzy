// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

export interface IWakatime {
	id: number;
	user_agent: string;
	type: string;
	employeeId: string;
	time: number;
	categories: string;
	dependencies: string;
	languages: string;
	machine: string;
	projects: string;
	branches: string;
	operating_systems: string;
	entities: string;
	editors: string;
	lines: string;
	is_write: boolean;
}
