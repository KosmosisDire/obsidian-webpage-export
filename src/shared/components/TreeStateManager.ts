import { createStore } from "solid-js/store";
import { createSignal, batch } from "solid-js";

export interface TreeItemData {
  id: string;
  title: string;
  icon?: string;
  href?: string;
  dataRef?: string;
  depth: number;
  children: TreeItemData[];
  isFolder?: boolean;
  originalExtension?: string;
  treeOrder?: number;
}

export class TreeStateManager<T extends TreeItemData = TreeItemData> {
  private store;
  private setStore;
  private collapsed;
  private setCollapsed;
  private selected;
  private setSelected;

  constructor(initialItems: T[] = []) {
    [this.store, this.setStore] = createStore<{ items: T[]; }>({ items: initialItems });
    [this.collapsed, this.setCollapsed] = createSignal<Set<string>>(new Set());
    [this.selected, this.setSelected] = createSignal<Set<string>>(new Set());
  }

  get items() {
    return this.store.items;
  }

  get collapsedSet() {
    return this.collapsed();
  }

  get selectedSet() {
    return this.selected();
  }

  setItems(items: T[]) {
    this.setStore("items", items);
  }

  updateItem(id: string, updates: Partial<T>) {
    this.setStore("items", item => item.id === id, updates as any);
  }

  isCollapsed(id: string): boolean {
    return this.collapsed().has(id);
  }

  toggleCollapse(id: string) {
    batch(() => {
      const set = new Set(this.collapsed());
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      this.setCollapsed(set);
    });
  }

  setCollapse(id: string, collapsed: boolean) {
    batch(() => {
      const set = new Set(this.collapsed());
      if (collapsed) {
        set.add(id);
      } else {
        set.delete(id);
      }
      this.setCollapsed(set);
    });
  }

  collapseAll() {
    const allIds = new Set<string>();
    const collectIds = (items: T[]) => {
      for (const item of items) {
        if (item.children && item.children.length > 0) {
          allIds.add(item.id);
          collectIds(item.children);
        }
      }
    };
    collectIds(this.items);
    this.setCollapsed(allIds);
  }

  expandAll() {
    this.setCollapsed(new Set());
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggleSelect(id: string) {
    batch(() => {
      const set = new Set(this.selected());
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      this.setSelected(set);
    });
  }

  forAllItems(callback: (item: T) => void, items: T[] = this.items) {
    for (const item of items) {
      callback(item);
      if (item.children && item.children.length > 0) {
        this.forAllItems(callback, item.children);
      }
    }
  }
}
