import { Modal, TFile } from "obsidian";
import { render } from "solid-js/web";
import { FilePickerTree } from "@shared/components/FilePickerTreeComponent";
import { FilePickerTree as FilePickerTreeClass } from "@shared/components/FilePickerTree";
import { FileData } from "../../shared/types";

export class FilePickerModal extends Modal {
  private filePickerRef: FilePickerTreeClass | null = null;
  private onFilesSelected: (files: string[]) => void;
  private cleanup: (() => void) | null = null;

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
    
    const exportButton = buttonContainer.createEl("button", { text: "Export Selected" });
    exportButton.addClass("mod-cta", "mod-warning");
    exportButton.onclick = () => {
      if (this.filePickerRef) {
        const selectedFiles = this.filePickerRef.getSelectedFiles();
        this.onFilesSelected(selectedFiles);
      }
      this.close();
    };

    // Store cleanup function for proper disposal
    this.cleanup = render(
      () => (
        <FilePickerTree
          files={Object.keys(files)}
          title="Select Files"
          ref={(ref: FilePickerTreeClass) => this.filePickerRef = ref}
          sort={true}
          showFileExtentionTags={true}
          hideFileExtentionTags={["md"]}
          startItemsCollapsed={true}
          class="file-picker"
        />
      ), 
      container
    );
  }

  onClose() {
    // Properly dispose of the SolidJS component
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
    this.contentEl.empty();
    this.filePickerRef = null;
  }
}