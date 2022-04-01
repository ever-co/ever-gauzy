import { Component, OnInit } from '@angular/core';

interface IWorkSpace {
	id: string;
	imgUrl: string;
	isOnline: boolean;
}

@Component({
	selector: 'gauzy-workspaces',
	templateUrl: './workspaces.component.html',
	styleUrls: ['./workspaces.component.scss']
})
export class WorkspacesComponent implements OnInit {
	mockedWorkSpaces: IWorkSpace[] = [];
	selected: IWorkSpace;
	options = [
		{ title: 'Sign in another workspace' },
		{ title: 'Create a new workspace' },
		{ title: 'Find workspace' }
	];

	constructor() {}

	ngOnInit(): void {
		this.loadWorkSpaces();
	}

	loadWorkSpaces() {
		let unique = 0;
		let lasts = [];
		for (let i = 0; i < 8; i++) {
			while (lasts.includes(unique)) {
				unique = Math.floor(Math.random() * (8 - 1)) + 1;
			}
			this.mockedWorkSpaces.push({
				id: '' + i,
				imgUrl:
					'https://source.unsplash.com/random/200x200?sig=' + unique,
				isOnline:
					Math.floor(Math.random() * (10 - 1)) + 1 > 5 ? true : false
			});
			lasts.push(unique);
		}
		this.selected = this.mockedWorkSpaces[Math.floor(Math.random() * 8)];
		this.selected.isOnline = true;
	}

	select(workSpace: IWorkSpace) {
		this.selected = workSpace;
		this.selected.isOnline = true;
	}

	add() {
		// TODO
	}
}
