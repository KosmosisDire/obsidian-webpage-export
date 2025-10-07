import { Component, For, Show, createEffect, createMemo, onMount, batch } from "solid-js";
import { TreeStateManager } from "@shared/components/TreeStateManager";
import { useCollapsible, useSelectable } from "@shared/components/useTreeBehaviors";
import { TreeContainer, TreeItem } from "@shared/components/TreeComponents";
import {
  FileTreeItemData,
  FileTreeOptions,
  transformFilesToTree,
  findItemByPath,
} from "@shared/components/FileTreeTransformer";

export interface FilePickerTreeRef {
  getSelectedFiles: () => string[];
  getSelectedPaths: () => string[];
  setSelectedPaths: (paths: string[]) => void;
  selectAll: (selected: boolean) => void;
}

export interface FilePickerTreeProps extends FileTreeOptions {
  files: string[];
  title?: string;
  minCollapsableDepth?: number;
  class?: string;
  id?: string;
  minDepth?: number;
  startItemsCollapsed?: boolean;
  renderMarkdownTitles?: boolean;
  onSelectionChange?: (selectedPaths: string[]) => void;
  initialSelection?: string[];
  ref?: (ref: FilePickerTreeRef) => void;
}

interface FilePickerTreeItemData extends FileTreeItemData {
  parentId?: string;
}

export class FilePickerTreeStateManager extends TreeStateManager<FilePickerTreeItemData> {
  private itemsById = new Map<string, FilePickerTreeItemData>();

  constructor(initialItems: FilePickerTreeItemData[] = []) {
    super(initialItems);
    this.buildItemsMap(initialItems);
  }

  setItems(items: FilePickerTreeItemData[]) {
    super.setItems(items);
    this.buildItemsMap(items);
  }

  private buildItemsMap(items: FilePickerTreeItemData[]) {
    this.itemsById.clear();
    const mapItems = (items: FilePickerTreeItemData[]) => {
      for (const item of items) {
        this.itemsById.set(item.id, item);
        if (item.children && item.children.length > 0) {
          mapItems(item.children);
        }
      }
    };
    mapItems(items);
  }

  selectWithChildren(itemId: string, selected: boolean) {
    batch(() => {
      // Select/deselect the item and all its descendants
      const selectDescendants = (id: string) => {
        const item = this.itemsById.get(id);
        if (!item) return;
        
        // Set selection state for this item
        if (selected && !this.isSelected(id)) {
          this.toggleSelect(id);
        } else if (!selected && this.isSelected(id)) {
          this.toggleSelect(id);
        }

        // Recursively select/deselect children
        if (item.children) {
          for (const child of item.children) {
            selectDescendants(child.id);
          }
        }
      };
      
      selectDescendants(itemId);
    });
  }

  selectAll(selected: boolean) {
    batch(() => {
      if (selected) {
        // Select all items
        this.forAllItems((item) => {
          if (!this.isSelected(item.id)) {
            this.toggleSelect(item.id);
          }
        });
      } else {
        // Clear all selections
        const allSelected = new Set(this.selectedSet);
        for (const id of allSelected) {
          this.toggleSelect(id);
        }
      }
    });
  }

  evaluateFolderSelections() {
    batch(() => {
      // Build a depth map to process from deepest to shallowest
      const depthMap = new Map<number, FilePickerTreeItemData[]>();
      let maxDepth = 0;
      
      this.forAllItems((item) => {
        const depth = item.depth;
        if (depth > maxDepth) maxDepth = depth;
        const items = depthMap.get(depth) || [];
        items.push(item);
        depthMap.set(depth, items);
      });

      // Process from deepest level upwards
      for (let depth = maxDepth; depth >= 1; depth--) {
        const items = depthMap.get(depth) || [];
        for (const item of items) {
          if (item.isFolder && item.children && item.children.length > 0) {
            // Check if all children are selected
            const allChildrenSelected = item.children.every(child => 
              this.isSelected(child.id)
            );
            
            // Only update if state needs to change
            const isCurrentlySelected = this.isSelected(item.id);
            if (allChildrenSelected && !isCurrentlySelected) {
              this.toggleSelect(item.id);
            } else if (!allChildrenSelected && isCurrentlySelected) {
              // Only deselect if we're not in the middle of a cascade selection
              // This prevents the folder from being deselected when we're selecting children
              this.toggleSelect(item.id);
            }
          }
        }
      }
    });
  }

  getSelectedPaths(): string[] {
    const selectedPaths: string[] = [];
    
    // Check if everything is selected (select all case)
    let totalItems = 0;
    let selectedItems = 0;
    this.forAllItems(() => {
      totalItems++;
    });
    for (const id of this.selectedSet) {
      selectedItems++;
    }
    
    if (totalItems > 0 && totalItems === selectedItems) {
      return ["all"];
    }

    // Build a set of all selected IDs for quick lookup
    const selectedIds = new Set(this.selectedSet);

    // Collect selected paths with optimization for folders
    const collectPaths = (items: FilePickerTreeItemData[]): string[] => {
      const paths: string[] = [];
      for (const item of items) {
        if (selectedIds.has(item.id)) {
          // If this item is selected, add its path
          paths.push(item.dataRef || item.id);
          // Don't traverse children since parent selection covers them
        } else if (item.children && item.children.length > 0) {
          // If folder not selected, check children
          paths.push(...collectPaths(item.children));
        }
      }
      return paths;
    };

    return collectPaths(this.items);
  }

  setSelectedPaths(paths: string[]) {
    batch(() => {
      // Clear all selections first
      this.selectAll(false);

      if (paths.includes("all")) {
        this.selectAll(true);
        return;
      }

      // Select specified paths
      for (const path of paths) {
        this.forAllItems((item) => {
          if (item.dataRef === path && !this.isSelected(item.id)) {
            this.toggleSelect(item.id);
          }
        });
      }

      // Evaluate folder selections based on children
      this.evaluateFolderSelections();
    });
  }
}

export function FilePickerTree(props: FilePickerTreeProps) {
  // Transform files into tree structure
  const treeItems = createMemo(() => {
    return transformFilesToTree(props.files, {
      sort: props.sort,
      regexBlacklist: props.regexBlacklist,
      regexWhitelist: props.regexWhitelist,
    });
  });

  // Create specialized state manager
  const stateManager = new FilePickerTreeStateManager(treeItems());

  // Update state when files change
  createEffect(() => {
    stateManager.setItems(treeItems());
  });

  // Apply initial selection
  onMount(() => {
    if (props.initialSelection) {
      stateManager.setSelectedPaths(props.initialSelection);
    }

    // Expose ref methods
    if (props.ref) {
      props.ref({
        getSelectedFiles: () => {
          const selectedFiles: string[] = [];
          stateManager.forAllItems((item) => {
            if (stateManager.isSelected(item.id) && !item.isFolder) {
              selectedFiles.push(item.dataRef || item.id);
            }
          });
          return selectedFiles;
        },
        getSelectedPaths: () => stateManager.getSelectedPaths(),
        setSelectedPaths: (paths: string[]) => stateManager.setSelectedPaths(paths),
        selectAll: (selected: boolean) => stateManager.selectAll(selected),
      });
    }
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

  // Track selection changes
  createEffect(() => {
    const selectedPaths = stateManager.getSelectedPaths();
    if (props.onSelectionChange) {
      props.onSelectionChange(selectedPaths);
    }
  });

  // Check if all items are selected
  const allSelected = createMemo(() => {
    let hasItems = false;
    stateManager.forAllItems(() => { hasItems = true; });
    
    if (!hasItems) return false;
    
    let allChecked = true;
    stateManager.forAllItems((item) => {
      if (!stateManager.isSelected(item.id)) {
        allChecked = false;
      }
    });
    return allChecked;
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

  // Handle select all
  const handleSelectAll = () => {
    stateManager.selectAll(!allSelected());
  };

  // Handle individual checkbox change
  const handleCheckboxChange = (itemId: string, checked: boolean, item: FilePickerTreeItemData) => {
    batch(() => {
      if (item.isFolder) {
        // For folders, select with all children
        stateManager.selectWithChildren(itemId, checked);
        // After changing folder selection, also evaluate all parent folders
        stateManager.evaluateFolderSelections();
      } else {
        // For files, just toggle selection
        if (checked && !stateManager.isSelected(itemId)) {
          stateManager.toggleSelect(itemId);
        } else if (!checked && stateManager.isSelected(itemId)) {
          stateManager.toggleSelect(itemId);
        }
        
        // After changing file selection, evaluate all parent folders
        stateManager.evaluateFolderSelections();
      }
    });
  };

  // Handle item click (toggles checkbox for files, collapses for folders)
  const handleItemClick = (event: MouseEvent, item: FilePickerTreeItemData) => {
    event.preventDefault();
    if (item.isFolder) {
      stateManager.toggleCollapse(item.id);
    } else {
      const isCurrentlySelected = stateManager.isSelected(item.id);
      handleCheckboxChange(item.id, !isCurrentlySelected, item);
    }
  };

  // Render extras (nothing for FilePicker, checkboxes are handled separately)
  const renderExtras = () => null;

  // Custom TreeItem for FilePickerTree with checkbox as first child
  const FilePickerTreeItem = (props: {
    item: FilePickerTreeItemData;
    children: any;
  }) => {
    const itemClasses = createMemo(() => {
      const classes = ["tree-item"];
      if (props.item.isFolder) {
        classes.push("nav-folder");
      } else {
        classes.push("nav-file");
      }
      if (isCollapsible(props.item)) {
        classes.push("mod-collapsible");
      }
      if (isCollapsed(props.item.id)) {
        classes.push("is-collapsed");
      }
      return classes.join(" ");
    });

    const selfClasses = createMemo(() => {
      const classes = ["tree-item-self", "is-clickable"];
      if (props.item.isFolder) {
        classes.push("nav-folder-title");
      } else {
        classes.push("nav-file-title");
      }
      if (isCollapsible(props.item)) {
        classes.push("mod-collapsible");
      }
      return classes.join(" ");
    });

    const childrenClasses = createMemo(() => {
      const classes = ["tree-item-children"];
      if (props.item.isFolder) {
        classes.push("nav-folder-children");
      } else {
        classes.push("nav-file-children");
      }
      return classes.join(" ");
    });

    return (
      <div class={itemClasses()} data-depth={props.item.depth}>
        <div
          class={selfClasses()}
          data-path={props.item.dataRef || props.item.href || props.item.title}
          onClick={(e) => handleItemClick(e, props.item)}
        >
          {/* Checkbox MUST be first child */}
          <input
            type="checkbox"
            class={`file-checkbox ${stateManager.isSelected(props.item.id) ? 'checked' : ''}`}
            checked={stateManager.isSelected(props.item.id)}
            onClick={(e) => {
              e.stopPropagation();
              const target = e.target as HTMLInputElement;
              handleCheckboxChange(props.item.id, target.checked, props.item);
            }}
          />

          {/* Collapse icon second (if collapsible) */}
          <Show when={isCollapsible(props.item)}>
            <div
              class={`tree-item-icon collapse-icon nav-folder-collapse-indicator ${
                isCollapsed(props.item.id) ? "is-collapsed" : ""
              }`}
              onClick={(e) => handleCollapseClick(e, props.item.id)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="svg-icon right-triangle"
              >
                <path d="M3 8L12 17L21 8"></path>
              </svg>
            </div>
          </Show>

          {/* Item inner content */}
          <div class={`tree-item-inner ${props.item.isFolder ? "nav-folder-title-content" : "nav-file-title-content"}`}>
            {props.item.title}
          </div>
        </div>

        <div
          class={childrenClasses()}
          style={{ display: isCollapsed(props.item.id) ? "none" : "block" }}
        >
          {props.children}
        </div>
      </div>
    );
  };

  // Recursive tree renderer
  const renderTreeItems = (items: FilePickerTreeItemData[]) => {
    // Filter by minDepth if specified
    const filteredItems = props.minDepth 
      ? items.filter(item => item.depth >= props.minDepth)
      : items;

    return (
      <For each={filteredItems}>
        {(item) => (
          <FilePickerTreeItem item={item}>
            <Show when={item.children && item.children.length > 0}>
              {renderTreeItems(item.children)}
            </Show>
          </FilePickerTreeItem>
        )}
      </For>
    );
  };

  // Custom container with Select All button
  return (
    <div id={props.id} class={`tree-container ${props.class || ''}`}>
      <div class="feature-header">
        <Show when={props.title}>
          <div class="feature-title">{props.title}</div>
        </Show>
        
        {/* Select All button */}
        <div class="tree-item select-all">
          <div 
            class="tree-item-self is-clickable"
            onClick={handleSelectAll}
          >
            <input
              type="checkbox"
              class={`file-checkbox ${allSelected() ? 'checked' : ''}`}
              checked={allSelected()}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectAll();
              }}
            />
            <div class="tree-item-inner">Select All</div>
          </div>
        </div>

        {/* Collapse All button */}
        <button
          class={`clickable-icon nav-action-button tree-collapse-all ${
            allCollapsed() ? "is-collapsed" : ""
          }`}
          aria-label="Collapse All"
          onClick={handleCollapseAll}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></svg>
        </button>
      </div>

      {renderTreeItems(stateManager.items)}
    </div>
  );
}
