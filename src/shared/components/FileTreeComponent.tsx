import { createEffect, onMount } from "solid-js";
import { FileTree as FileTreeClass } from "./FileTree";

interface TreeProps {
  title?: string;
  minCollapsableDepth?: number;
  class?: string;
  id?: string;
  showNestingIndicator?: boolean;
  minDepth?: number;
  startItemsCollapsed?: boolean;
  makeLinksWebStyle?: boolean;
  renderMarkdownTitles?: boolean;
  addCollapseAllButton?: boolean;
}

interface FileTreeProps extends TreeProps {
  files: string[];
  onFileClick?: (path: string) => void;
  
  // FileTree specific properties
  showFileExtentionTags?: boolean;
  hideFileExtentionTags?: string[];
  regexBlacklist?: string[];
  regexWhitelist?: string[];
  sort?: boolean;
}

export function FileTree(props: FileTreeProps) {
  let containerRef: HTMLDivElement;
  let treeInstance: FileTreeClass;

  onMount(async () => {
    treeInstance = new FileTreeClass(props.files, props.sort);
    
    // Apply BaseTree properties
    if (props.title !== undefined) treeInstance.title = props.title;
    if (props.minCollapsableDepth !== undefined) treeInstance.minCollapsableDepth = props.minCollapsableDepth;
    if (props.class !== undefined) treeInstance.class = props.class;
    if (props.id !== undefined) treeInstance.id = props.id;
    if (props.showNestingIndicator !== undefined) treeInstance.showNestingIndicator = props.showNestingIndicator;
    if (props.minDepth !== undefined) treeInstance.minDepth = props.minDepth;
    if (props.startItemsCollapsed !== undefined) treeInstance.startItemsCollapsed = props.startItemsCollapsed;
    if (props.makeLinksWebStyle !== undefined) treeInstance.makeLinksWebStyle = props.makeLinksWebStyle;
    if (props.renderMarkdownTitles !== undefined) treeInstance.renderMarkdownTitles = props.renderMarkdownTitles;
    if (props.addCollapseAllButton !== undefined) treeInstance.addCollapseAllButton = props.addCollapseAllButton;
    
    // Apply FileTree properties
    if (props.showFileExtentionTags !== undefined) treeInstance.showFileExtentionTags = props.showFileExtentionTags;
    if (props.hideFileExtentionTags !== undefined) treeInstance.hideFileExtentionTags = props.hideFileExtentionTags;
    if (props.regexBlacklist !== undefined) treeInstance.regexBlacklist = props.regexBlacklist;
    if (props.regexWhitelist !== undefined) treeInstance.regexWhitelist = props.regexWhitelist;

    await treeInstance.generate(containerRef);
    
    // Set up file click handler if provided
    if (props.onFileClick) {
      treeInstance.forAllChildren((item) => {
        if (!item.isFolder && item.itemEl) {
          item.itemEl.addEventListener('click', () => {
            props.onFileClick!(item.dataRef || '');
          });
        }
      });
    }
  });

  createEffect(() => {
    if (treeInstance && containerRef) {
      // Update files when props change
      treeInstance.files = props.files.map(f => new (treeInstance.files[0].constructor as any)(f));
      containerRef.innerHTML = '';
      treeInstance.generate(containerRef);
    }
  });

  return <div ref={containerRef!} />;
}