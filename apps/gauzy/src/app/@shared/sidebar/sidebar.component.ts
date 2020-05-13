import { Component, OnInit } from '@angular/core';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
	knowledgeBases = [
		{
			// 1 2 0 0 2 0 0
			id: 'knowledgeBase_1',
			childCategories: [
				{
					id: 'childCategory_1',
					title: 'xyz1',
					childArticles: [],
					childCategories: [
						{
							id: 'childCategory_1_1',
							title: 'xyz11',
							childArticles: [],
							childCategories: []
						},
						{
							id: 'childCategory_1_2',
							title: 'xyz12',
							childArticles: [],
							childCategories: []
						}
					]
				}
			]
		},
		{
			id: 'knowledgeBase_2',
			childCategories: [
				{
					id: 'childCategory_1',
					childArticles: [],
					childCategories: []
				},
				{
					id: 'childCategory_2',
					childArticles: [],
					childCategories: []
				}
			]
		}
	];
	addKnowledgeBase() {}
	constructor() {}

	ngOnInit() {}
}
