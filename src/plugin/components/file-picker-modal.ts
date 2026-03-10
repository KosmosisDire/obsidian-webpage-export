import { Modal } from "obsidian";
import { createFilePickerTree, FilePickerTreeHandle } from "../../shared/components/file-picker-tree";
import { FileData } from "../../shared/types";

export class FilePickerModal extends Modal {
	private handle: FilePickerTreeHandle | null = null;
	private onFilesSelected: (files: string[]) => void;

	constructor(
		app: any,
		files: Record<string, FileData>,
		onFilesSelected: (files: string[]) => void
	) {
		super(app);
		this.onFilesSelected = onFilesSelected;
		this.setupModal(files);
	}

	private setupModal(files: Record<string, FileData>) {
		this.modalEl.addClass("file-picker-modal");
		this.titleEl.setText("Select Files to Export");

		const container = this.contentEl.createDiv("file-picker-container");
		container.style.height = "400px";
		container.style.overflow = "auto";

		const buttonContainer = this.contentEl.createDiv(
			"modal-button-container"
		);
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "8px";
		buttonContainer.style.marginTop = "16px";

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.addClass("mod-cta");
		cancelButton.onclick = () => this.close();

		const exportButton = buttonContainer.createEl("button", {
			text: "Export Selected",
		});
		exportButton.addClass("mod-cta", "mod-warning");
		exportButton.onclick = () => {
			if (this.handle) {
				this.onFilesSelected(this.handle.getSelectedFiles());
			}
			this.close();
		};

		this.handle = createFilePickerTree(Object.keys(files), {
			title: "Select Files",
			sort: true,
			startCollapsed: true,
			class: "file-picker",
		});
		this.handle.tree.mount(container);
	}

	onClose() {
		if (this.handle) {
			this.handle.tree.destroy();
			this.handle = null;
		}
		this.contentEl.empty();
	}
}
