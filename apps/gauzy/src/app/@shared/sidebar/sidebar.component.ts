import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { TreeComponent } from 'angular-tree-component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { helpCenterMenuList, IHelpCenter } from '@gauzy/models';
import { isEqual } from './delete-node';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private readonly fb: FormBuilder,
		private sanitizer: DomSanitizer,
		// private helpService: HelpCenterService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}
	form: FormGroup;
	public articleName = 'Chose any article';
	public articleDesc = '';
	public articleData: SafeHtml;
	public showPrivateButton = false;
	public showPublicButton = false;
	public showArticleButton = false;
	public showCategoryButton = false;
	public nodeId = 0;
	public chosenCategory = false;
	public chosenArticle = false;
	public isVisibleAdd = false;
	public isVisibleEdit = false;
	public iconsShow = false;
	public isChosenNode = false;
	public nodes = helpCenterMenuList;
	@ViewChild(TreeComponent)
	private tree: TreeComponent;

	addNode() {
		this.isVisibleAdd = true;
	}
	showInput(key: number) {
		if (key === 1) {
			this.showArticleButton = true;
		} else {
			this.showCategoryButton = true;
		}
	}

	addName(event: any, key: number) {
		// this.isChosenNode = false;
		if (key !== 1) {
			this.nodes.push({
				name: `${event.target.value}`,
				icon: 'book-open-outline',
				flag: 'category',
				privacy: 'eye-outline',
				children: []
			});
			console.log('categ');
		} else {
			this.nodes.push({
				name: `${event.target.value}`,
				icon: 'book-open-outline',
				flag: 'article',
				privacy: 'eye-outline',
				description: '',
				data: ''
			});
		}
		// await this.helpService.create({
		// 	name: `${event.target.value}`,
		//  description: '',
		// 	data: '',
		// 	children: [],
		// });
		// this.loadMenu();
		this.tree.treeModel.update();
		this.isVisibleAdd = false;
		this.showArticleButton = false;
		this.showCategoryButton = false;
	}
	onNodeClicked(node: any) {
		this.nodeId = node.data.id;
		this.isChosenNode = true;
		if (node.data.flag === 'article') {
			this.articleDesc = node.data.description;
			this.articleName = node.data.name;
			this.articleData = node.data.data as SafeHtml;
			this.chosenCategory = false;
			this.chosenArticle = true;
			this.loadFormData();
		} else {
			this.articleName = 'Chose any article';
			this.chosenCategory = true;
			this.chosenArticle = false;
		}
		if (node.data.privacy === 'eye-outline') {
			this.showPrivateButton = true;
			this.showPublicButton = false;
		} else {
			this.showPrivateButton = false;
			this.showPublicButton = true;
		}
	}
	onCloseAdding() {
		this.isVisibleAdd = false;
	}
	onCloseInput() {
		this.showArticleButton = false;
		this.showCategoryButton = false;
	}

	addIcon() {
		this.iconsShow = true;
	}

	onIconset(icon) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.icon = icon;
		this.tree.treeModel.update();
		// if (!someNode.children) {
		// 	this.articleDesc = someNode.description;
		// 	this.articleName = someNode.name;
		// }
		this.iconsShow = false;
	}

	onCloseIcon() {
		this.iconsShow = false;
	}

	makePrivate() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		if (someNode.data.children) {
			this.treeWalk(someNode.data.children, 'eye-off-outline');
		}
		someNode.data.privacy = 'eye-off-outline';
		this.showPrivateButton = false;
		this.showPublicButton = true;
		this.tree.treeModel.update();
	}

	makePublic() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		if (someNode.data.children) {
			this.treeWalk(someNode.data.children, 'eye-outline');
		}
		someNode.data.privacy = 'eye-outline';
		this.showPrivateButton = true;
		this.showPublicButton = false;
		this.tree.treeModel.update();
	}
	treeWalk(nodes: IHelpCenter[], newPrivacy: string) {
		for (let i = 0; i < nodes.length; i++) {
			if (nodes[i].children) {
				this.treeWalk(nodes[i].children, newPrivacy);
			}
			nodes[i].privacy = newPrivacy;
		}
	}

	editNameCategory(event: any) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.name = event.target.value;
		this.isVisibleEdit = false;
		// await this.helpService.update({
		// 	name: `${someNode.data.name}`,
		// });
		// this.loadMenu();
	}

	onEditArticle() {
		this.isVisibleEdit = true;
	}

	onDeleteArticle() {
		isEqual(this.nodes, this.nodeId);
		//await this.helpService.delete(`${this.nodeId}`);
		this.tree.treeModel.update();
		this.isChosenNode = false;
		this.articleName = 'Chose any article';
	}

	loadFormData() {
		this.form = this.fb.group({
			name: [this.articleName],
			desc: [this.articleDesc],
			data: [this.articleData]
		});
	}

	editData(value: string) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		this.articleData = this.sanitizer.bypassSecurityTrustHtml(value);
		someNode.data.data = this.articleData as string;
		// await this.helpService.update({
		// 	data: `${someNode.data.data}`,
		// });
		// this.loadMenu();
	}

	submit() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.description = this.form.controls.desc.value;
		someNode.data.name = this.form.controls.name.value;
		this.articleDesc = someNode.data.description;
		this.articleName = someNode.data.name;
		// await this.helpService.update({
		// 	name: `${someNode.data.name}`,
		// 	description: `${someNode.data.description}`,
		// });
		// this.loadMenu();
		this.isVisibleEdit = false;
	}

	// private async loadMenu() {
	// 	const result = await this.helpService.getAll();
	// 	if (result) {
	// 		this.nodes = result.items;
	// 	}
	// }
	ngOnInit() {
		// this.loadMenu();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
