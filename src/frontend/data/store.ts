import { createSignal, createMemo } from 'solid-js';

export interface FileData {
    path: string;
    modified: number;
    exported: number;
    frontmatter: any;
    content: {
        markdown: string;
        html: string;
    };
    treeOrder: number;
}

export interface WebsiteData {
    export: {
        version: string;
        timestamp: number;
        vault: string;
        totalFiles: number;
    };
    files: Record<string, FileData>;
    indices: {
        search?: any;
        graph: {
            nodes: Array<{ id: string; group: string }>;
            edges: Array<{ source: string; target: string; type: string }>;
        };
        tags: Record<string, string[]>;
    };
}

class VaultStore {
    private websiteDataSignal = createSignal<WebsiteData | null>(null);
    private loadingSignal = createSignal(false);
    private errorSignal = createSignal<string | null>(null);

    private setWebsiteData = this.websiteDataSignal[1];
    private setLoading = this.loadingSignal[1];
    private setError = this.errorSignal[1];

    get websiteData() { return this.websiteDataSignal[0](); }
    get loading() { return this.loadingSignal[0](); }
    get error() { return this.errorSignal[0](); }

    // Memoized computed values
    fileList = createMemo(() => {
        const data = this.websiteData;
        return data ? Object.keys(data.files) : [];
    });

    fileTree = createMemo(() => {
        const files = this.fileList();
        const tree: Record<string, any> = {};

        files.forEach(filePath => {
            const parts = filePath.split('/');
            let current = tree;

            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    current[part] = { type: 'file', path: filePath };
                } else {
                    if (!current[part]) {
                        current[part] = { type: 'folder', children: {} };
                    }
                    current = current[part].children;
                }
            });
        });

        return tree;
    });

    async load(): Promise<void> {
        this.setLoading(true);
        this.setError(null);

        try {
            // Try to load from embedded data first
            const embedScript = document.getElementById('obsidian-data');
            if (embedScript && embedScript.textContent) {
                console.log('Loading data from embedded script');
                const data: WebsiteData = JSON.parse(embedScript.textContent);
                this.setWebsiteData(data);
                this.setLoading(false);
                return;
            }

            // Fallback to loading from files.json
            console.log('Loading data from files.json');
            const response = await fetch('./files.json');
            if (!response.ok) {
                throw new Error(`Failed to load files.json: ${response.statusText}`);
            }
            
            const data: WebsiteData = await response.json();
            this.setWebsiteData(data);

        } catch (error) {
            console.error('Failed to load vault data:', error);
            this.setError(error instanceof Error ? error.message : 'Failed to load data');
        } finally {
            this.setLoading(false);
        }
    }

    getFile(path: string): FileData | null {
        const data = this.websiteData;
        if (!data || !data.files) return null;
        return data.files[path] || null;
    }

    getFileList(): string[] {
        return this.fileList();
    }

    getFileTree() {
        return this.fileTree();
    }

    documentExists(path: string): boolean {
        const data = this.websiteData;
        if (!data || !data.files) return false;
        return path in data.files;
    }
}

// Export singleton instance
export const vaultStore = new VaultStore();

//@ts-ignore
window.vaultStore = vaultStore; // For debugging