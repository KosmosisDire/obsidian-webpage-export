import { TreeItemData } from "./TreeStateManager";

export interface FileTreeItemData extends TreeItemData {
  isFolder: boolean;
  originalExtension?: string;
  file?: { path: string; basename: string; extensionName: string; };
}

export interface FileTreeOptions {
  sort?: boolean;
  showFileExtensionTags?: boolean;
  hideFileExtensionTags?: string[];
  regexBlacklist?: string[];
  regexWhitelist?: string[];
}

// Simple Path class replacement for the transformation logic
class SimplePath {
  path: string;
  
  constructor(path: string) {
    this.path = path;
  }

  get basename(): string {
    const parts = this.path.split('/');
    const filename = parts[parts.length - 1] || '';
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(0, lastDot) : filename;
  }

  get fullName(): string {
    const parts = this.path.split('/');
    return parts[parts.length - 1] || '';
  }

  get extensionName(): string {
    const filename = this.fullName;
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot + 1) : '';
  }

  get parent(): SimplePath | undefined {
    const lastSlash = this.path.lastIndexOf('/');
    if (lastSlash <= 0) return undefined;
    return new SimplePath(this.path.substring(0, lastSlash));
  }

  get isDirectory(): boolean {
    return this.path.endsWith('/');
  }

  get parentPath(): string {
    const lastSlash = this.path.lastIndexOf('/');
    return lastSlash > 0 ? this.path.substring(0, lastSlash) : '';
  }
}

export function transformFilesToTree(
  files: string[],
  options: FileTreeOptions = {}
): FileTreeItemData[] {
  const {
    sort = true,
    regexBlacklist = [],
    regexWhitelist = [],
  } = options;

  // Filter files based on regex patterns
  let filteredFiles = files.filter((file) => {
    const passesBlacklist = regexBlacklist.length === 0 || 
      regexBlacklist.every((pattern) => !file.match(new RegExp(pattern)));
    const passesWhitelist = regexWhitelist.length === 0 || 
      regexWhitelist.some((pattern) => file.match(new RegExp(pattern)));
    return passesBlacklist && passesWhitelist;
  });

  // Build tree structure
  const rootItems: FileTreeItemData[] = [];
  const itemMap = new Map<string, FileTreeItemData>();

  for (const filePath of filteredFiles) {
    const path = new SimplePath(filePath);
    const pathSegments: string[] = [];
    
    // Build path segments from root to file
    let currentPath = filePath;
    while (currentPath && currentPath !== '/') {
      pathSegments.unshift(currentPath);
      const lastSlash = currentPath.lastIndexOf('/');
      currentPath = lastSlash > 0 ? currentPath.substring(0, lastSlash) : '';
    }

    // Create tree items for each segment
    let parentItems = rootItems;
    let parentPath = '';

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      const segmentPath = new SimplePath(segment);
      const isLastSegment = i === pathSegments.length - 1;
      const isFolder = !isLastSegment || segment.endsWith('/');
      
      // Check if item already exists
      let item = itemMap.get(segment);
      
      if (!item) {
        // Create new item
        const itemName = isLastSegment ? segmentPath.fullName : 
          segment.substring(parentPath.length + (parentPath ? 1 : 0)).replace(/\/$/, '');
        
        item = {
          id: segment,
          title: isFolder ? itemName : segmentPath.basename,
          depth: i + 1,
          dataRef: segment,
          href: !isFolder ? segment : undefined,
          isFolder,
          children: [],
          originalExtension: !isFolder ? segmentPath.extensionName : undefined,
          file: !isFolder ? {
            path: segment,
            basename: segmentPath.basename,
            extensionName: segmentPath.extensionName,
          } : undefined,
        };

        itemMap.set(segment, item);
        parentItems.push(item);
      }

      parentItems = item.children;
      parentPath = segment;
    }
  }

  // Sort tree if requested
  if (sort) {
    sortTree(rootItems);
  }

  // Assign tree order
  let orderCounter = 0;
  assignTreeOrder(rootItems, () => orderCounter++);

  return rootItems;
}

function sortTree(items: FileTreeItemData[]) {
  // Sort alphabetically first
  items.sort((a, b) => 
    a.title.localeCompare(b.title, undefined, { numeric: true })
  );
  
  // Then sort folders before files
  items.sort((a, b) => {
    if (a.isFolder === b.isFolder) return 0;
    return a.isFolder ? -1 : 1;
  });

  // Recursively sort children
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      sortTree(item.children);
    }
  }
}

function assignTreeOrder(items: FileTreeItemData[], getNextOrder: () => number) {
  for (const item of items) {
    item.treeOrder = getNextOrder();
    if (item.children && item.children.length > 0) {
      assignTreeOrder(item.children, getNextOrder);
    }
  }
}

export function findItemByPath(
  items: FileTreeItemData[],
  path: string
): FileTreeItemData | undefined {
  for (const item of items) {
    if (item.dataRef === path || item.href === path) {
      return item;
    }
    if (item.children) {
      const found = findItemByPath(item.children, path);
      if (found) return found;
    }
  }
  return undefined;
}
