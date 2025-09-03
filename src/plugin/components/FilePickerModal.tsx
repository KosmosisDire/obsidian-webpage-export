import { Modal, TFile } from "obsidian";
import { render } from "solid-js/web";
import { FilePickerExplorer, FilePickerExplorerRef } from "./FilePickerExplorer";
import { FileData } from "../../shared/types";

export class FilePickerModal extends Modal {
  private filePickerRef: FilePickerExplorerRef | null = null;
  private onFilesSelected: (files: string[]) => void;

  constructor(app: any, files: Record<string, FileData>, onFilesSelected: (files: string[]) => void) {
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
    
    const buttonContainer = this.contentEl.createDiv("modal-button-container");
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.marginTop = "16px";
    
    const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
    cancelButton.addClass("mod-cta");
    cancelButton.onclick = () => this.close();
    
    const selectButton = buttonContainer.createEl("button", { text: "Export Selected" });
    selectButton.addClass("mod-cta");
    selectButton.onclick = () => {
      if (this.filePickerRef) {
        const selectedFiles = this.filePickerRef.getSelectedFiles();
        this.onFilesSelected(selectedFiles);
      }
      this.close();
    };

    render(() => 
      <FilePickerExplorer
        files={files}
        title="Files"
        ref={(ref) => this.filePickerRef = ref}
      />, 
      container
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}