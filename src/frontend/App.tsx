import { Router, Route, useLocation } from '@solidjs/router';
import { onMount, createSignal, Show, Suspense, createEffect } from 'solid-js';
import { vaultStore } from './data/store';
import { FileExplorer } from './components/FileExplorer';
import { DocumentViewer } from './components/DocumentViewer';

function Layout(props: any) {
  const [filesReady, setFilesReady] = createSignal(false);
  const location = useLocation();
  
  createEffect(() => {
    console.log('Navigation:', location.pathname);
  });
  
  onMount(async () => {
    try {
      await vaultStore.load();
      setFilesReady(true);
      console.log('Vault data loaded successfully');
    } catch (error) {
      console.error('Failed to load vault data:', error);
    }
  });
  
  return (
    <div id="main" class="mod-windows">
      <div id="main-horizontal">
        <div
          id="left-content"
          class="leaf"
          style="--sidebar-width: var(--sidebar-width-left)"
        >
          <div id="left-sidebar" class="sidebar">
            <div class="sidebar-handle"></div>
            <div class="sidebar-topbar">
              <div class="topbar-content">
                <div id="search-container">
                  <div id="search-wrapper">
                    <input
                      enterkeyhint="search"
                      type="search"
                      spellcheck={false}
                      placeholder="Search..."
                    />
                    <div
                      aria-label="Clear search"
                      id="search-clear-button"
                    ></div>
                  </div>
                </div>
              </div>
              <div class="clickable-icon sidebar-collapse-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="100%"
                  height="100%"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"></path>
                  <path d="M10 4V20"></path>
                  <path d="M4 7H7"></path>
                  <path d="M4 10H7"></path>
                  <path d="M4 13H7"></path>
                </svg>
              </div>
            </div>
            <div class="sidebar-content-wrapper">
              <div id="left-sidebar-content" class="leaf-content">
                <Suspense fallback={<div class="loading">Loading files...</div>}>
                  <Show when={filesReady() && !vaultStore.loading}>
                    <FileExplorer />
                  </Show>
                </Suspense>
              </div>
            </div>
          </div>
        </div>
        
        <div id="center-content" class="leaf">
          <Suspense fallback={<div class="loading">Loading...</div>}>
            <Show when={filesReady()}>
              {props.children}
            </Show>
          </Suspense>
        </div>
        
        <div
          id="right-content"
          class="leaf"
          style="--sidebar-width: var(--sidebar-width-right)"
        >
          <div id="right-sidebar" class="sidebar">
            <div class="sidebar-handle"></div>
            <div class="sidebar-topbar">
              <div class="topbar-content">
                <label
                  class="theme-toggle-container"
                  for="theme-toggle-input"
                >
                  <input
                    class="theme-toggle-input"
                    type="checkbox"
                    id="theme-toggle-input"
                  />
                  <div class="toggle-background"></div>
                </label>
              </div>
              <div class="clickable-icon sidebar-collapse-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="100%"
                  height="100%"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="svg-icon"
                >
                  <path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z"></path>
                  <path d="M10 4V20"></path>
                  <path d="M4 7H7"></path>
                  <path d="M4 10H7"></path>
                  <path d="M4 13H7"></path>
                </svg>
              </div>
            </div>
            <div class="sidebar-content-wrapper">
              <div id="right-sidebar-content" class="leaf-content">
                <div class="outline-placeholder">
                  <p>Right sidebar content</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  // Load the first file or show a welcome message
  const homeFile = () => {
    const files = vaultStore.getFileList();
    const indexFile = files.find(f => f.toLowerCase().includes('index') || f.toLowerCase().includes('home'));
    return indexFile || files[0];
  };

  return (
    <Show 
      when={homeFile()} 
      fallback={
        <div class="obsidian-document markdown-preview-view">
          <div class="markdown-preview-sizer markdown-preview-section">
            <h1>Welcome to your Obsidian Vault</h1>
            <p>Select a file from the sidebar to view its content.</p>
          </div>
        </div>
      }
    >
      {(file) => <DocumentViewer path={file()} />}
    </Show>
  );
}

export function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={HomePage} />
      <Route path="/*path" component={(props) => {
        return <DocumentViewer path={props.params.path} />;
      }} />
    </Router>
  );
}