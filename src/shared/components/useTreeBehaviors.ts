import { createSignal, onCleanup, Accessor } from "solid-js";
import { TreeStateManager, TreeItemData } from "./TreeStateManager";

export interface CollapsibleOptions {
  minCollapsableDepth?: number;
  startItemsCollapsed?: boolean;
}

export function useCollapsible<T extends TreeItemData>(
  stateManager: TreeStateManager<T>,
  options: CollapsibleOptions = {}
) {
  const { minCollapsableDepth = 1, startItemsCollapsed = false } = options;

  // Initialize collapsed state if needed
  if (startItemsCollapsed) {
    stateManager.forAllItems((item) => {
      if (item.children && item.children.length > 0 && item.depth >= minCollapsableDepth) {
        stateManager.setCollapse(item.id, true);
      }
    });
  }

  const isCollapsible = (item: T) => {
    return item.children && item.children.length > 0 && item.depth >= minCollapsableDepth;
  };

  const handleCollapseClick = (event: MouseEvent, itemId: string) => {
    event.stopPropagation();
    event.preventDefault();
    stateManager.toggleCollapse(itemId);
  };

  const handleCollapseAll = () => {
    const allCollapsed = stateManager.collapsedSet.size > 0;
    if (allCollapsed) {
      stateManager.expandAll();
    } else {
      stateManager.collapseAll();
    }
  };

  return {
    isCollapsible,
    handleCollapseClick,
    handleCollapseAll,
    isCollapsed: (id: string) => stateManager.isCollapsed(id),
  };
}

export interface NavigationOptions {
  onItemClick?: (item: TreeItemData) => void;
  onItemSelect?: (item: TreeItemData) => void;
}

export function useTreeNavigation<T extends TreeItemData>(
  stateManager: TreeStateManager<T>,
  options: NavigationOptions = {}
) {
  const [focusedId, setFocusedId] = createSignal<string | null>(null);

  const handleItemClick = (event: MouseEvent, item: T) => {
    // For folders, toggle collapse
    if (item.isFolder && item.children && item.children.length > 0) {
      stateManager.toggleCollapse(item.id);
    }
    
    // Call custom handler if provided
    if (options.onItemClick) {
      options.onItemClick(item);
    }
    
    // Handle href navigation
    if (item.href && !item.isFolder) {
      // Let the default link behavior handle navigation
      // unless prevented by custom handler
    }
  };

  const handleKeyDown = (event: KeyboardEvent, item: T) => {
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        if (item.isFolder) {
          stateManager.toggleCollapse(item.id);
        } else if (options.onItemSelect) {
          options.onItemSelect(item);
        }
        break;
      case "ArrowLeft":
        if (item.isFolder && !stateManager.isCollapsed(item.id)) {
          stateManager.setCollapse(item.id, true);
        }
        break;
      case "ArrowRight":
        if (item.isFolder && stateManager.isCollapsed(item.id)) {
          stateManager.setCollapse(item.id, false);
        }
        break;
    }
  };

  return {
    focusedId,
    setFocusedId,
    handleItemClick,
    handleKeyDown,
  };
}

export interface SelectableOptions {
  multiSelect?: boolean;
  cascadeSelection?: boolean;
}

export function useSelectable<T extends TreeItemData>(
  stateManager: TreeStateManager<T>,
  options: SelectableOptions = {}
) {
  const { multiSelect = true, cascadeSelection = false } = options;

  const handleSelect = (itemId: string, checked: boolean) => {
    if (!multiSelect) {
      // Clear all selections first
      stateManager.forAllItems((item) => {
        if (stateManager.isSelected(item.id)) {
          stateManager.toggleSelect(item.id);
        }
      });
    }

    // Toggle the selection
    if (checked && !stateManager.isSelected(itemId)) {
      stateManager.toggleSelect(itemId);
    } else if (!checked && stateManager.isSelected(itemId)) {
      stateManager.toggleSelect(itemId);
    }

    // Handle cascade selection if enabled
    if (cascadeSelection) {
      const findAndSelectChildren = (items: T[]): void => {
        for (const item of items) {
          if (item.id === itemId && item.children) {
            selectAllChildren(item.children, checked);
            break;
          }
          if (item.children) {
            findAndSelectChildren(item.children);
          }
        }
      };

      const selectAllChildren = (children: T[], selected: boolean) => {
        for (const child of children) {
          if (selected && !stateManager.isSelected(child.id)) {
            stateManager.toggleSelect(child.id);
          } else if (!selected && stateManager.isSelected(child.id)) {
            stateManager.toggleSelect(child.id);
          }
          if (child.children) {
            selectAllChildren(child.children, selected);
          }
        }
      };

      findAndSelectChildren(stateManager.items);
    }
  };

  return {
    isSelected: (id: string) => stateManager.isSelected(id),
    handleSelect,
    selectedIds: () => stateManager.selectedSet,
  };
}
