import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';


export default class HTMLExportPlugin extends Plugin {

	async onload() 
	{
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
			  menu.addItem((item) => {
				item
				  .setTitle("Print file path 👈")
				  .setIcon("document")
				  .onClick(async () => {
					new Notice(view.file.path);
				  });
			  });
			})
		  );
	}

	onunload() 
	{

	}
}