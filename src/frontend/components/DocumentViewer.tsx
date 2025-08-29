import { createMemo, createEffect, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { vaultStore } from '../data/store';

interface DocumentViewerProps {
  path?: string;
}

export function DocumentViewer(props?: DocumentViewerProps) {
  const params = useParams();
  const navigate = useNavigate();
  
  // Get the file path from props or params
  const filePath = createMemo(() => {
    let path = props?.path || params.path || '';
    
    // Try to decode URL encoding, but handle malformed URIs
    if (path) {
      try {
        path = decodeURIComponent(path);
      } catch (error) {
        console.warn('Failed to decode URL, using original path:', path);
        // Keep the original path if decoding fails
      }
    }
    
    // Convert HTML path back to MD path
    if (path.endsWith('.html')) {
      path = path.replace(/\.html$/, '.md');
    }
    
    // If no extension, try adding .md
    if (path && !path.includes('.') && !path.endsWith('/')) {
      path = path + '.md';
    }
    
    // Handle root path
    if (!path || path === '/' || path === '') {
      const files = vaultStore.getFileList();
      const homeFile = files.find(f => f.toLowerCase().includes('index') || f.toLowerCase().includes('home'));
      return homeFile || files[0] || null;
    }
    
    return path || null;
  });

  const fileData = createMemo(() => {
    const path = filePath();
    
    if (!path) {
      console.warn('No file path provided');
      return null;
    }
    
    const fileData = vaultStore.getFile(path);
    if (!fileData) {
      console.warn(`File not found: ${path}`);
      return null;
    }
    
    console.log('Loaded page:', fileData.path);
    return fileData;
  });

  const fileName = createMemo(() => {
    const path = filePath();
    if (!path || typeof path !== 'string') return 'Untitled';
    return path.split('/').pop()?.replace(/\.md$/, '') || 'Untitled';
  });

  // Set up link handling after content is rendered
  createEffect(() => {
    const content = fileData();
    if (content) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        setupInternalLinks();
      }, 0);
    }
  });

  const setupInternalLinks = () => {
    // Find all internal links and set up navigation
    document.querySelectorAll('.obsidian-document a[href]').forEach((link: HTMLAnchorElement) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#')) return;
      
      // Remove any existing click handlers
      const newLink = link.cloneNode(true) as HTMLAnchorElement;
      link.parentNode?.replaceChild(newLink, link);
      
      newLink.addEventListener('click', (e) => {
        e.preventDefault();
        
        let targetPath = href;
        
        // Convert to proper path
        if (targetPath.endsWith('.html')) {
          targetPath = targetPath.replace(/\.html$/, '.md');
        }
        
        // Check if file exists
        if (vaultStore.documentExists(targetPath)) {
          const htmlPath = targetPath.replace(/\.md$/, '.html');
          navigate(`/${htmlPath}`);
        } else {
          newLink.classList.add('is-unresolved');
        }
      });
      
      // Mark unresolved links
      let targetPath = href;
      if (targetPath.endsWith('.html')) {
        targetPath = targetPath.replace(/\.html$/, '.md');
      }
      
      if (!vaultStore.documentExists(targetPath)) {
        newLink.classList.add('is-unresolved');
      }
    });
  };

  return (
    <Show 
      when={fileData()} 
      fallback={
        <div class="obsidian-document markdown-preview-view">
          <div class="view-content">
            <div class="markdown-reading-view">
              <div class="markdown-preview-view markdown-rendered">
                <div class="markdown-preview-section">
                  <Show when={vaultStore.error}>
                    <p class="error">Error loading content: {vaultStore.error}</p>
                  </Show>
                  <Show when={!vaultStore.error}>
                    <p>File not found or still loading...</p>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {(file) => (
        <div class="obsidian-document markdown-preview-view" innerHTML={file().content?.html || '<p>No content available</p>'}></div>
      )}
    </Show>
  );
}