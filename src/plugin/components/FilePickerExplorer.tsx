import { For, createSignal, createMemo } from 'solid-js';
import { FileData } from '../../shared/types';

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
  fullSelection: Set<string>;
  onItemSelect: (path: string, selected: boolean) => void;
  folderPath: string;
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
      // For files, clicking anywhere should select/deselect
      const newSelected = !isSelected();
      props.onItemSelect(props.item.path!, newSelected);
      props.onFileClick?.(props.item.path!);
    }
  };

  const handleCheckboxClick = (e: MouseEvent) => {
    e.stopPropagation();
    const itemPath = isFolder() ? props.folderPath : props.item.path!;
    const newSelected = !isSelected();
    props.onItemSelect(itemPath, newSelected);
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

  const isSelected = () => {
    const itemPath = isFolder() ? props.folderPath : props.item.path!;
    return props.fullSelection.has(itemPath); // Simple O(1) lookup!
  };

  return (
    <div 
      class={`tree-item ${isFolder() ? 'nav-folder' : 'nav-file'} ${hasChildren() ? 'mod-collapsible' : ''} ${collapsed() ? 'is-collapsed' : ''} ${isSelected() ? 'is-selected' : ''}`}
      data-depth={props.depth || 1}
    >
      {isFolder() ? (
        <div 
          class="tree-item-self is-clickable mod-collapsible nav-folder-title"
          data-path={props.name}
          onClick={handleClick}
        >
          <div 
            class={`tree-item-checkbox ${isSelected() ? 'is-checked' : ''}`}
            onClick={handleCheckboxClick}
          >
            <span class="checkbox-indicator">✓</span>
          </div>
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
          <div 
            class={`tree-item-checkbox ${isSelected() ? 'is-checked' : ''}`}
            onClick={handleCheckboxClick}
          >
            <span class="checkbox-indicator">✓</span>
          </div>
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
                fullSelection={props.fullSelection}
                onItemSelect={props.onItemSelect}
                folderPath={props.folderPath + '/' + childName}
              />
            )}
          </For>
        </div>
      )}
    </div>
  );
}

interface FilePickerExplorerProps {
  files: Record<string, FileData>;
  title?: string;
  onFileClick?: (path: string) => void;
  onFolderClick?: (folderName: string) => void;
  renderFileLink?: (path: string, displayName: string) => any;
  ref?: (ref: FilePickerExplorerRef) => void;
}

export function FilePickerExplorer(props: FilePickerExplorerProps) {
  const [allCollapsed, setAllCollapsed] = createSignal(false);
  const [canonicalSelection, setCanonicalSelection] = createSignal<Set<string>>(new Set());
  
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

  // Expand canonical selection to full selection (includes all inherited selections)
  const expandCanonicalToFull = (canonical: Set<string>): Set<string> => {
    const result = new Set<string>();
    
    for (const item of canonical) {
      result.add(item);
      
      if (!props.files[item]) {
        // It's a folder - add all files within this folder
        Object.keys(props.files).forEach(filePath => {
          if (filePath.startsWith(item + '/')) {
            result.add(filePath);
          }
        });
        
        // Add all subfolders within this folder (derived from file paths)
        const subfolders = new Set<string>();
        Object.keys(props.files).forEach(filePath => {
          if (filePath.startsWith(item + '/')) {
            const relativePath = filePath.substring(item.length + 1);
            const pathParts = relativePath.split('/');
            for (let i = 1; i < pathParts.length; i++) {
              const subfolderPath = item + '/' + pathParts.slice(0, i).join('/');
              subfolders.add(subfolderPath);
            }
          }
        });
        
        subfolders.forEach(subfolder => result.add(subfolder));
      }
    }
    
    return result;
  };

  // Computed full selection state
  const fullSelection = createMemo(() => expandCanonicalToFull(canonicalSelection()));

  // Get all direct children (files and folders) of a given folder path
  const getDirectChildren = (folderPath: string): string[] => {
    const children = new Set<string>();
    
    // Add all files that are direct children
    Object.keys(props.files).forEach(filePath => {
      if (filePath.startsWith(folderPath + '/') && 
          !filePath.substring(folderPath.length + 1).includes('/')) {
        children.add(filePath);
      }
    });
    
    // Add all folders that are direct children
    Object.keys(props.files).forEach(filePath => {
      if (filePath.startsWith(folderPath + '/')) {
        const relativePath = filePath.substring(folderPath.length + 1);
        const firstSlashIndex = relativePath.indexOf('/');
        if (firstSlashIndex !== -1) {
          const childFolderPath = folderPath + '/' + relativePath.substring(0, firstSlashIndex);
          children.add(childFolderPath);
        }
      }
    });
    
    return Array.from(children);
  };

  // Canonicalize selection to maintain invariant: never store parent and child together
  const canonicalizeSelection = (selection: Set<string>): Set<string> => {
    const items = Array.from(selection).sort(); // Sort for consistent processing
    const canonical = new Set<string>();
    
    for (const item of items) {
      // Only add this item if no existing item in canonical set contains it
      const isRedundant = Array.from(canonical).some(existing => 
        item.startsWith(existing + '/') // item is a child of existing
      );
      
      if (!isRedundant) {
        // Add this item, but first remove any existing items that this item contains
        Array.from(canonical).forEach(existing => {
          if (existing.startsWith(item + '/')) {
            canonical.delete(existing); // existing is a child of item
          }
        });
        canonical.add(item);
      }
    }
    
    return canonical;
  };

  // View 1: Get selected items as user selected them (canonical - mix of files and folders)
  const getSelectedItems = () => Array.from(canonicalSelection());

  // View 2: Get all files that would be exported (expand canonical to actual files only)
  const getFilesToExport = () => {
    const result: string[] = [];
    const canonical = canonicalSelection();
    
    for (const item of canonical) {
      if (props.files[item]) {
        // It's a file
        result.push(item);
      } else {
        // It's a folder - expand to all files in that folder (including subfolders)
        Object.keys(props.files).forEach(filePath => {
          if (filePath.startsWith(item + '/')) {
            result.push(filePath);
          }
        });
      }
    }
    
    return result;
  };

  const handleDeselection = (currentCanonical: Set<string>, pathToDeselect: string): Set<string> => {
    let result = new Set(currentCanonical);
    
    // Remove the item itself (may not be in canonical, but just in case)
    result.delete(pathToDeselect);
    
    // Find the nearest selected ancestor and split it
    const pathParts = pathToDeselect.split('/');
    for (let i = pathParts.length - 1; i > 0; i--) {
      const ancestorPath = pathParts.slice(0, i).join('/');
      if (result.has(ancestorPath)) {
        // Split this ancestor
        result.delete(ancestorPath);
        
        // Add all direct children except the path we're deselecting
        getDirectChildren(ancestorPath).forEach(childPath => {
          // Don't add back the item we're deselecting or any of its ancestors
          if (!pathToDeselect.startsWith(childPath + '/') && childPath !== pathToDeselect) {
            result.add(childPath);
          }
        });
        
        // Now recursively check if any newly added items also contain the deselected path
        const newItems = Array.from(result);
        for (const newItem of newItems) {
          if (newItem !== ancestorPath && pathToDeselect.startsWith(newItem + '/')) {
            // This newly added item also contains our deselected path - split it too
            const furtherSplit = handleDeselection(result, pathToDeselect);
            return furtherSplit;
          }
        }
        
        break;
      }
    }
    
    return result;
  };

  const handleSelection = (currentCanonical: Set<string>, pathToSelect: string): Set<string> => {
    let result = new Set(currentCanonical);
    result.add(pathToSelect);
    
    // Check if selecting this item means all siblings are now selected -> consolidate to parent
    const pathParts = pathToSelect.split('/');
    if (pathParts.length > 1) {
      const parentPath = pathParts.slice(0, -1).join('/');
      const allSiblings = getDirectChildren(parentPath);
      
      // Check if all siblings are now selected
      const allSiblingsSelected = allSiblings.every(siblingPath => 
        result.has(siblingPath) || 
        // Check if sibling is covered by some other selected ancestor
        Array.from(result).some(selectedItem => 
          siblingPath.startsWith(selectedItem + '/') || siblingPath === selectedItem
        )
      );
      
      if (allSiblingsSelected && allSiblings.length > 0) {
        // Remove all siblings and add parent instead
        allSiblings.forEach(siblingPath => result.delete(siblingPath));
        result.add(parentPath);
        
        // Recursively check if this parent selection triggers further consolidation
        return handleSelection(result, parentPath);
      }
    }
    
    return result;
  };

  const handleItemSelect = (path: string, selected: boolean) => {
    if (selected) {
      // Selection with auto-consolidation logic
      const newItems = handleSelection(canonicalSelection(), path);
      setCanonicalSelection(canonicalizeSelection(newItems));
    } else {
      // Complex deselection with cascading logic
      const newItems = handleDeselection(canonicalSelection(), path);
      setCanonicalSelection(canonicalizeSelection(newItems));
    }
  };

  const clearSelection = () => {
    setCanonicalSelection(new Set<string>());
  };
  
  const selectAll = () => {
    const allFilePaths = Object.keys(props.files);
    setCanonicalSelection(new Set(allFilePaths));
  };

  // Expose methods via ref
  if (props.ref) {
    props.ref({
      getSelectedFiles: getFilesToExport, // For backwards compatibility, export the actual files
      clearSelection,
      selectAll
    });
  }

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
    <div id="file-picker-explorer" class="tree-container file-picker">
      <div class="feature-header">
        <div class="feature-title">{props.title || 'Select Files'}</div>
        <div style="display: flex; gap: 4px;">
          <button
            class="clickable-icon nav-action-button"
            aria-label="Select All"
            onClick={selectAll}
            title="Select All"
          >
            ✓
          </button>
          <button
            class="clickable-icon nav-action-button"
            aria-label="Clear Selection"
            onClick={clearSelection}
            title="Clear Selection"
          >
            ✗
          </button>
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
      </div>
      
      <div class="selection-info" style="padding: 8px; font-size: 0.9em; color: var(--text-muted);">
        {canonicalSelection().size} item{canonicalSelection().size !== 1 ? 's' : ''} selected
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
            fullSelection={fullSelection()}
            onItemSelect={handleItemSelect}
            folderPath={name}
          />
        )}
      </For>
    </div>
  );
}

// Export helper functions to access selection state from parent components
export type FilePickerExplorerRef = {
  getSelectedFiles: () => string[];
  clearSelection: () => void;
  selectAll: () => void;
};