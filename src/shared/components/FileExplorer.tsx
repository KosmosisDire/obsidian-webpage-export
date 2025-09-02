import { For, createSignal, createMemo } from 'solid-js';
import { FileData } from '../types';

interface TreeItem {
  type: 'file' | 'folder';
  path?: string;
  children?: Record<string, TreeItem>;
}

interface TreeItemProps {
  name: string;
  item: TreeItem;
  depth?: number;
  onFileClick?: (path: string) => void;
  onFolderClick?: (folderName: string) => void;
  renderFileLink?: (path: string, displayName: string) => any;
}

function TreeItemComponent(props: TreeItemProps) {
  const [collapsed, setCollapsed] = createSignal(true);
  
  const isFolder = () => props.item.type === 'folder';
  const hasChildren = () => isFolder() && props.item.children && Object.keys(props.item.children).length > 0;
  
  const handleClick = (e: MouseEvent) => {
    if (isFolder()) {
      e.preventDefault();
      setCollapsed(!collapsed());
      props.onFolderClick?.(props.name);
    } else {
      props.onFileClick?.(props.item.path!);
    }
  };

  const fileName = () => {
    if (isFolder()) {
      return props.name;
    }
    return props.name.replace(/\.md$/, '');
  };

  const getFileExtension = () => {
    if (isFolder()) return '';
    const parts = props.name.split('.');
    return parts.length > 1 ? parts.pop() : '';
  };

  return (
    <div 
      class={`tree-item ${isFolder() ? 'nav-folder' : 'nav-file'} ${hasChildren() ? 'mod-collapsible' : ''} ${collapsed() ? 'is-collapsed' : ''}`}
      data-depth={props.depth || 1}
    >
      {isFolder() ? (
        <div 
          class="tree-item-self is-clickable mod-collapsible nav-folder-title"
          data-path={props.name}
          onClick={handleClick}
        >
          {hasChildren() && (
            <div class={`tree-item-icon collapse-icon nav-folder-collapse-indicator ${collapsed() ? 'is-collapsed' : ''}`}>
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
          )}
          <div class="tree-item-inner nav-folder-title-content">
            {fileName()}
          </div>
        </div>
      ) : (
        <div
          class="tree-item-self is-clickable nav-file-title"
          data-path={props.item.path}
          onClick={handleClick}
        >
          {props.renderFileLink ? 
            props.renderFileLink(props.item.path!, fileName()) :
            <>
              <div class="tree-item-inner nav-file-title-content">
                {fileName()}
              </div>
              {getFileExtension() && getFileExtension() !== 'md' && (
                <div class="nav-file-tag">{getFileExtension()}</div>
              )}
            </>
          }
        </div>
      )}
      
      {hasChildren() && !collapsed() && (
        <div class={`tree-item-children ${isFolder() ? 'nav-folder-children' : 'nav-file-children'}`}>
          <For each={Object.entries(props.item.children!)}>
            {([childName, childItem]) => (
              <TreeItemComponent 
                name={childName} 
                item={childItem} 
                depth={(props.depth || 1) + 1}
                onFileClick={props.onFileClick}
                onFolderClick={props.onFolderClick}
                renderFileLink={props.renderFileLink}
              />
            )}
          </For>
        </div>
      )}
    </div>
  );
}

interface FileExplorerProps {
  files: Record<string, FileData>;
  title?: string;
  onFileClick?: (path: string) => void;
  onFolderClick?: (folderName: string) => void;
  renderFileLink?: (path: string, displayName: string) => any;
}

export function FileExplorer(props: FileExplorerProps) {
  const [allCollapsed, setAllCollapsed] = createSignal(false);
  
  const fileTree = createMemo(() => {
    const tree: Record<string, TreeItem> = {};
    const fileList = Object.keys(props.files);

    fileList.forEach(filePath => {
      const parts = filePath.split('/');
      let current = tree;

      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = { type: 'file', path: filePath };
        } else {
          if (!current[part]) {
            current[part] = { type: 'folder', children: {} };
          }
          current = current[part].children!;
        }
      });
    });

    return tree;
  });

  const toggleCollapseAll = () => {
    setAllCollapsed(!allCollapsed());
  };

  const sortedEntries = createMemo(() => {
    const tree = fileTree();
    const entries = Object.entries(tree);
    
    return entries.sort(([aName, aItem], [bName, bItem]) => {
      const aIsFolder = aItem.type === 'folder';
      const bIsFolder = bItem.type === 'folder';
      
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      
      return aName.localeCompare(bName, undefined, { numeric: true });
    });
  });

  return (
    <div id="file-explorer" class="tree-container">
      <div class="feature-header">
        <div class="feature-title">{props.title || 'Files'}</div>
        <button
          class={`clickable-icon nav-action-button tree-collapse-all ${allCollapsed() ? 'is-collapsed' : ''}`}
          aria-label="Collapse All"
          onClick={toggleCollapseAll}
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
          >
            <path d="m7 15 5 5 5-5"></path>
            <path d="m7 9 5-5 5 5"></path>
          </svg>
        </button>
      </div>
      
      <For each={sortedEntries()}>
        {([name, item]) => (
          <TreeItemComponent 
            name={name} 
            item={item} 
            depth={1}
            onFileClick={props.onFileClick}
            onFolderClick={props.onFolderClick}
            renderFileLink={props.renderFileLink}
          />
        )}
      </For>
    </div>
  );
}