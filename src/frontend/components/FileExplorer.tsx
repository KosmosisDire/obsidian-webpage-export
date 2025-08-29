import { For, createSignal, createMemo } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { vaultStore } from '../data/store';

interface TreeItemProps {
  name: string;
  item: any;
  depth?: number;
}

function TreeItem(props: TreeItemProps) {
  const [collapsed, setCollapsed] = createSignal(true);
  const navigate = useNavigate();
  
  const isFolder = () => props.item.type === 'folder';
  const hasChildren = () => isFolder() && props.item.children && Object.keys(props.item.children).length > 0;
  
  const handleClick = (e: MouseEvent) => {
    if (isFolder()) {
      e.preventDefault();
      setCollapsed(!collapsed());
    } else {
      // Navigate to the file
      const htmlPath = props.item.path.replace(/\.md$/, '.html');
      navigate(`/${htmlPath}`);
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
        <A 
          href={`/${props.item.path.replace(/\.md$/, '.html')}`}
          class="tree-item-self is-clickable nav-file-title"
          data-path={props.item.path}
        >
          <div class="tree-item-inner nav-file-title-content">
            {fileName()}
          </div>
          {getFileExtension() && getFileExtension() !== 'md' && (
            <div class="nav-file-tag">{getFileExtension()}</div>
          )}
        </A>
      )}
      
      {hasChildren() && !collapsed() && (
        <div class={`tree-item-children ${isFolder() ? 'nav-folder-children' : 'nav-file-children'}`}>
          <For each={Object.entries(props.item.children)}>
            {([childName, childItem]) => (
              <TreeItem 
                name={childName} 
                item={childItem} 
                depth={(props.depth || 1) + 1}
              />
            )}
          </For>
        </div>
      )}
    </div>
  );
}

export function FileExplorer() {
  const [allCollapsed, setAllCollapsed] = createSignal(false);
  
  const fileTree = createMemo(() => {
    return vaultStore.getFileTree();
  });

  const toggleCollapseAll = () => {
    setAllCollapsed(!allCollapsed());
    // This would need to communicate with all TreeItem components
    // For now, just toggle the state
  };

  const sortedEntries = createMemo(() => {
    const tree = fileTree();
    const entries = Object.entries(tree);
    
    // Sort folders first, then files, both alphabetically
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
        <div class="feature-title">Development</div>
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
          <TreeItem name={name} item={item} depth={1} />
        )}
      </For>
    </div>
  );
}