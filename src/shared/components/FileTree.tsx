import { Component, For, Show, createEffect, createMemo, onMount } from "solid-js";
import { TreeStateManager } from "./TreeStateManager";
import { useCollapsible, useTreeNavigation } from "./useTreeBehaviors";
import { TreeContainer, TreeItem } from "./TreeComponents";
import {
  FileTreeItemData,
  FileTreeOptions,
  transformFilesToTree,
  findItemByPath,
} from "./FileTreeTransformer";

export interface FileTreeProps extends FileTreeOptions {
  files: string[];
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
  onFileClick?: (path: string) => void;
  showFileExtensionTags?: boolean;
  hideFileExtensionTags?: string[];
}

export function FileTree(props: FileTreeProps) {
  // Transform files into tree structure
  const treeItems = createMemo(() => {
    return transformFilesToTree(props.files, {
      sort: props.sort,
      showFileExtensionTags: props.showFileExtensionTags,
      hideFileExtensionTags: props.hideFileExtensionTags,
      regexBlacklist: props.regexBlacklist,
      regexWhitelist: props.regexWhitelist,
    });
  });

  // Create state manager
  const stateManager = new TreeStateManager<FileTreeItemData>(treeItems());

  // Update state when files change
  createEffect(() => {
    stateManager.setItems(treeItems());
  });

  // Setup collapsible behavior
  const {
    isCollapsible,
    handleCollapseClick,
    handleCollapseAll,
    isCollapsed,
  } = useCollapsible(stateManager, {
    minCollapsableDepth: props.minCollapsableDepth || 1,
    startItemsCollapsed: props.startItemsCollapsed,
  });

  // Setup navigation behavior
  const { handleItemClick } = useTreeNavigation(stateManager, {
    onItemClick: (item) => {
      if (!item.isFolder && props.onFileClick) {
        props.onFileClick(item.dataRef || item.href || "");
      }
    },
  });

  // Check if all items are collapsed
  const allCollapsed = createMemo(() => {
    let hasCollapsible = false;
    let allAreCollapsed = true;
    
    stateManager.forAllItems((item) => {
      if (isCollapsible(item)) {
        hasCollapsible = true;
        if (!stateManager.isCollapsed(item.id)) {
          allAreCollapsed = false;
        }
      }
    });

    return hasCollapsible && allAreCollapsed;
  });

  // Render icon for items
  const renderIcon = (item: FileTreeItemData) => {
    if (!item.icon || item.icon.trim() === "") return null;
    return (
      <div class="tree-icon iconize-icon">
        {item.icon}
      </div>
    );
  };

  // Render inner content
  const renderInner = (item: FileTreeItemData) => {
    const innerClasses = () => {
      const classes = ["tree-item-inner"];
      if (item.isFolder) {
        classes.push("nav-folder-title-content");
      } else {
        classes.push("nav-file-title-content");
      }
      return classes.join(" ");
    };

    return (
      <div class={innerClasses()}>
        {item.title}
      </div>
    );
  };

  // Render file extension tag
  const renderExtras = (item: FileTreeItemData) => {
    const showTag = !item.isFolder && 
      props.showFileExtensionTags !== false &&
      item.originalExtension &&
      item.originalExtension !== "" &&
      (!props.hideFileExtensionTags || 
       !props.hideFileExtensionTags.includes(item.originalExtension));

    if (!showTag) return null;

    return (
      <div class="nav-file-tag">
        {item.originalExtension}
      </div>
    );
  };

  // Recursive tree renderer
  const renderTreeItems = (items: FileTreeItemData[]) => {
    // Filter by minDepth if specified
    const filteredItems = props.minDepth 
      ? items.filter(item => item.depth >= props.minDepth)
      : items;

    return (
      <For each={filteredItems}>
        {(item) => (
          <TreeItem
            item={item}
            isCollapsed={isCollapsed(item.id)}
            isCollapsible={isCollapsible(item)}
            onCollapseClick={(e) => handleCollapseClick(e, item.id)}
            onItemClick={(e) => handleItemClick(e, item)}
            renderIcon={renderIcon}
            renderInner={renderInner}
            renderExtras={renderExtras}
          >
            <Show when={item.children && item.children.length > 0}>
              {renderTreeItems(item.children)}
            </Show>
          </TreeItem>
        )}
      </For>
    );
  };

  return (
    <TreeContainer
      id={props.id}
      class={props.class}
      title={props.title}
      showCollapseAll={props.addCollapseAllButton !== false}
      onCollapseAll={handleCollapseAll}
      allCollapsed={allCollapsed()}
    >
      {renderTreeItems(stateManager.items)}
    </TreeContainer>
  );
}

// Export a function to get item by path for external use
export function getFileTreeItemByPath(
  items: FileTreeItemData[],
  path: string
): FileTreeItemData | undefined {
  return findItemByPath(items, path);
}
