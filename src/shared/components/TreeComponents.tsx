import { Component, For, Show, createMemo, JSX } from "solid-js";
import { TreeItemData } from "./TreeStateManager";

export interface TreeItemProps<T extends TreeItemData> {
  item: T;
  isCollapsed: boolean;
  isCollapsible: boolean;
  isSelected?: boolean;
  onCollapseClick?: (event: MouseEvent) => void;
  onItemClick?: (event: MouseEvent) => void;
  renderIcon?: (item: T) => JSX.Element;
  renderInner?: (item: T) => JSX.Element;
  renderExtras?: (item: T) => JSX.Element;
  children?: JSX.Element;
}

export function TreeItem<T extends TreeItemData>(props: TreeItemProps<T>) {
  const itemClasses = createMemo(() => {
    const classes = ["tree-item"];
    if (props.item.isFolder) {
      classes.push("nav-folder");
    } else {
      classes.push("nav-file");
    }
    if (props.isCollapsible) {
      classes.push("mod-collapsible");
    }
    if (props.isCollapsed) {
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
    if (props.isCollapsible) {
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
      <Show
        when={props.item.href && !props.item.isFolder}
        fallback={
          <div
            class={selfClasses()}
            data-path={props.item.dataRef || props.item.href || props.item.title}
            onClick={props.onItemClick}
          >
        <Show when={props.isCollapsible}>
          <div
            class={`tree-item-icon collapse-icon nav-folder-collapse-indicator ${
              props.isCollapsed ? "is-collapsed" : ""
            }`}
            onClick={props.onCollapseClick}
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

        <Show when={props.renderIcon}>
          {props.renderIcon!(props.item)}
        </Show>

        <Show
          when={props.renderInner}
          fallback={
            <div class={`tree-item-inner ${props.item.isFolder ? "nav-folder-title-content" : "nav-file-title-content"}`}>
              {props.item.title}
            </div>
          }
        >
          {props.renderInner!(props.item)}
        </Show>

            <Show when={props.renderExtras}>
              {props.renderExtras!(props.item)}
            </Show>
          </div>
        }
      >
        <a
          class={selfClasses()}
          href={props.item.href}
          data-path={props.item.dataRef || props.item.href || props.item.title}
          onClick={props.onItemClick}
        >
          <Show when={props.isCollapsible}>
            <div
              class={`tree-item-icon collapse-icon nav-folder-collapse-indicator ${
                props.isCollapsed ? "is-collapsed" : ""
              }`}
              onClick={props.onCollapseClick}
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

          <Show when={props.renderIcon}>
            {props.renderIcon!(props.item)}
          </Show>

          <Show
            when={props.renderInner}
            fallback={
              <div class={`tree-item-inner ${props.item.isFolder ? "nav-folder-title-content" : "nav-file-title-content"}`}>
                {props.item.title}
              </div>
            }
          >
            {props.renderInner!(props.item)}
          </Show>

          <Show when={props.renderExtras}>
            {props.renderExtras!(props.item)}
          </Show>
        </a>
      </Show>

      <div
        class={childrenClasses()}
        style={{ display: props.isCollapsed ? "none" : "block" }}
      >
        {props.children}
      </div>
    </div>
  );
}

export interface TreeContainerProps {
  id?: string;
  class?: string;
  title?: string;
  showCollapseAll?: boolean;
  onCollapseAll?: () => void;
  allCollapsed?: boolean;
  children: JSX.Element;
}

export function TreeContainer(props: TreeContainerProps) {
  const containerClasses = createMemo(() => {
    const classes = ["tree-container"];
    if (props.class) {
      classes.push(props.class);
    }
    return classes.join(" ");
  });

  return (
    <div id={props.id} class={containerClasses()}>
      <Show when={props.title || props.showCollapseAll}>
        <div class="feature-header">
          <Show when={props.title}>
            <div class="feature-title">{props.title}</div>
          </Show>
          <Show when={props.showCollapseAll}>
            <button
              class={`clickable-icon nav-action-button tree-collapse-all ${
                props.allCollapsed ? "is-collapsed" : ""
              }`}
              aria-label="Collapse All"
              onClick={props.onCollapseAll}
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
          </Show>
        </div>
      </Show>
      {props.children}
    </div>
  );
}
