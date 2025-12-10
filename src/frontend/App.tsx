import { onMount, createSignal, Show, Suspense } from "solid-js";
import { vaultStore } from "./data/store";
import { FileTree } from "@shared/components/FileTree";
import { DocumentViewerPage } from "./components/DocumentViewerPage";
import { Path } from "@shared/path";
import { createRouter, Route, FileUrl } from "./router";

function Layout(props: any) {
	const [filesReady, setFilesReady] = createSignal(false);

	onMount(async () => {
		try {
			await vaultStore.load();
			setFilesReady(true);
			console.log("Vault data loaded successfully");
		} catch (error) {
			console.error("Failed to load vault data:", error);
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
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="svg-icon sidebar-toggle-button-icon"
								>
									<rect
										x="1"
										y="2"
										width="22"
										height="20"
										rx="4"
									></rect>
									<rect
										x="4"
										y="5"
										width="2"
										height="14"
										rx="2"
										fill="currentColor"
										class="sidebar-toggle-icon-inner"
									></rect>
								</svg>
							</div>
						</div>
						<div class="sidebar-content-wrapper">
							<div id="left-sidebar-content" class="leaf-content">
								<Suspense
									fallback={
										<div class="loading">
											Loading files...
										</div>
									}
								>
									<Show
										when={
											filesReady() && !vaultStore.loading
										}
									>
										<FileTree
											files={Object.keys(
												vaultStore.websiteData?.files ||
													{}
											)}
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
						<Show when={filesReady()}>{props.children}</Show>
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
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="svg-icon sidebar-toggle-button-icon"
								>
									<rect
										x="1"
										y="2"
										width="22"
										height="20"
										rx="4"
									></rect>
									<rect
										x="4"
										y="5"
										width="2"
										height="14"
										rx="2"
										fill="currentColor"
										class="sidebar-toggle-icon-inner"
									></rect>
								</svg>
							</div>
						</div>
						<div class="sidebar-content-wrapper">
							<div
								id="right-sidebar-content"
								class="leaf-content"
							>
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


export function App() {
	var currentPath = new Path(document.querySelector('meta[name="abs-path"]')?.getAttribute("content") || "/");
	var pathToRoot = new Path(document.querySelector('meta[name="path-to-root"]')?.getAttribute("content") || "./");
    var currentLocation = new Path(window.location.pathname);
    var rootPath = currentLocation.join(pathToRoot);
	
    const urlMapper = (url: string, fromUrl?: FileUrl): FileUrl => {
		url = url.trim();
        let originalUrl = url;
		let webPath = url;
        let vaultPath = url;
		let path = new Path(url);

        console.log(currentLocation.toString(), pathToRoot.toString(), path.toString(), rootPath.toString());
        
        if (path.isDirectory)
        {
			webPath += "index.html";
            vaultPath += "index.html";
            path = path.joinString("index.html");
		} 

        path = currentLocation.join(pathToRoot).join(path);
		

        webPath = path.toString();

		console.log("Mapping '" + originalUrl + "' to:\n'" + webPath + "' (web)\n'" + vaultPath + "' (vault)");
		return new FileUrl(webPath, vaultPath);
	};

	const router = createRouter({ urlMapper });
	console.log("Current path:", router.currentPath());

	return (
		<Layout>
			<Route
				router={router}
				resolver={(path) => <DocumentViewerPage path={path.vaultPath} />}
			/>
		</Layout>
	);
}
