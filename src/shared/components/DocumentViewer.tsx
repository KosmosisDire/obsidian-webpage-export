import { createMemo, createEffect, Show } from 'solid-js';
import { FileData } from '../types';

interface DocumentViewerProps {
  fileData: FileData | null;
  error?: string | null;
  isLoading?: boolean;
  onLinkClick?: (href: string) => void;
  checkDocumentExists?: (path: string) => boolean;
}

export function DocumentViewer(props: DocumentViewerProps) {
  const fileName = createMemo(() => {
    if (!props.fileData?.path) return 'Untitled';
    return props.fileData.path.split('/').pop()?.replace(/\.md$/, '') || 'Untitled';
  });

  // Set up link handling after content is rendered
  createEffect(() => {
    if (props.fileData) {
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
        
        // Call the provided link handler
        props.onLinkClick?.(targetPath);
      });
      
      // Mark unresolved links
      let targetPath = href;
      if (targetPath.endsWith('.html')) {
        targetPath = targetPath.replace(/\.html$/, '.md');
      }
      
      if (props.checkDocumentExists && !props.checkDocumentExists(targetPath)) {
        newLink.classList.add('is-unresolved');
      }
    });
  };

  return (
    <Show 
      when={props.fileData} 
      fallback={
        <div class="obsidian-document markdown-preview-view">
          <div class="view-content">
            <div class="markdown-reading-view">
              <div class="markdown-preview-view markdown-rendered">
                <div class="markdown-preview-section">
                  <Show when={props.error}>
                    <p class="error">Error loading content: {props.error}</p>
                  </Show>
                  <Show when={!props.error && props.isLoading}>
                    <p>Loading...</p>
                  </Show>
                  <Show when={!props.error && !props.isLoading}>
                    <p>File not found</p>
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