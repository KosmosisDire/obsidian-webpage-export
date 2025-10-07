import { Router, Route } from '@solidjs/router';
import { onMount, createSignal, Show, Suspense } from 'solid-js';
import { vaultStore } from './data/store';
import { FileTree } from '@shared/components/FileTree';
import { DocumentViewerPage } from './components/DocumentViewerPage';
import { useLocation } from '@solidjs/router';
import { Path } from '@shared/path';

function Layout(props: any) {
  const [filesReady, setFilesReady] = createSignal(false);
  
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon sidebar-toggle-button-icon"><rect x="1" y="2" width="22" height="20" rx="4"></rect><rect x="4" y="5" width="2" height="14" rx="2" fill="currentColor" class="sidebar-toggle-icon-inner"></rect></svg>
              </div>
            </div>
            <div class="sidebar-content-wrapper">
              <div id="left-sidebar-content" class="leaf-content">
                <Suspense fallback={<div class="loading">Loading files...</div>}>
                  <Show when={filesReady() && !vaultStore.loading}>
                    <FileTree
                      files={Object.keys(vaultStore.websiteData?.files || {})}
                      title="Development"
                      startItemsCollapsed={true}
                      id="file-explorer"
                    />
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon sidebar-toggle-button-icon"><rect x="1" y="2" width="22" height="20" rx="4"></rect><rect x="4" y="5" width="2" height="14" rx="2" fill="currentColor" class="sidebar-toggle-icon-inner"></rect></svg>
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
  return <DocumentViewerPage />;
}
interface RouterOptions {
	urlMapper?: (url: string) => string;
}

function createCustomRouter(options: RouterOptions = {}) {
	const { urlMapper } = options;
	const [currentPath, setCurrentPath] = createSignal(window.location.pathname + window.location.search + window.location.hash);
	const [clickedHref, setClickedHref] = createSignal<string | null>(null);

	const handlePopState = () => {
		setCurrentPath(window.location.pathname + window.location.search + window.location.hash);
		setClickedHref(null);
	};

	const navigate = (href: string, originalHref?: string) => {
		setClickedHref(originalHref || href);
		const mappedHref = urlMapper ? urlMapper(href) : href;
		setCurrentPath(mappedHref);
		window.history.pushState({ clickedHref: originalHref || href }, '', mappedHref);
	};

	const setupRouter = () => {
		const handleClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const anchor = target.closest('a');
			
			if (anchor && anchor.href && !anchor.target) {
				e.preventDefault();
				const rawHref = anchor.getAttribute('href');
				const resolvedHref = anchor.href;
				navigate(resolvedHref, rawHref ?? undefined);
			}
		};

		window.addEventListener('popstate', handlePopState);
		document.addEventListener('click', handleClick);
		
		return () => {
			window.removeEventListener('popstate', handlePopState);
			document.removeEventListener('click', handleClick);
		};
	};

	return { currentPath, clickedHref, navigate, setupRouter };
}

function trim(str: string): string {
	return str.replace(/^\s+|\s+$/g, '');
}

export function App() {
	const urlMapper = (url: string): string =>
	{
		var path = new Path(url);

		if (path.isDirectory)
		{
			return url + (url.endsWith('/') ? '' : '/') + 'index.html';
		}
		
		var toRoot = Array(path.depth).fill('..').join('/') + "/";
		url = toRoot + path.fullName;
		
		return url;
	};

	const { currentPath, setupRouter } = createCustomRouter({ urlMapper });

	onMount(setupRouter);

	return (
		<Layout>
			<DocumentViewerPage path={currentPath()} />
		</Layout>
	);
}
