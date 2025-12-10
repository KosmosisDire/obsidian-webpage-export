import { createSignal, onCleanup, JSX } from 'solid-js';

export interface RouterOptions {
	urlMapper?: (url: string, fromUrl?: FileUrl) => FileUrl;
}

export interface RouterContext {
	currentPath: () => FileUrl;
	clickedHref: () => string | null;
	navigate: (href: string, originalHref?: string) => void;
	resolvePath: (path: string, fromPath?: FileUrl) => FileUrl;
}

export class FileUrl
{
	webPath: string;
	vaultPath: string;

	constructor(webPath: string, vaultPath: string) {
		this.webPath = webPath;
		this.vaultPath = vaultPath;
	}
}


export function createRouter(options: RouterOptions = {}): RouterContext {
	const { urlMapper } = options;

	const resolvePath = (path: string, fromPath?: FileUrl): FileUrl => {
		return urlMapper ? urlMapper(path, fromPath) : new FileUrl(path, path);
	};

	const [currentPath, setCurrentPath] = createSignal(
		resolvePath(window.location.pathname + window.location.search + window.location.hash)
	);
	const [clickedHref] = createSignal<string | null>(null);

	const handlePopState = () => {
		const fullPath = window.location.pathname + window.location.search + window.location.hash;
		setCurrentPath(resolvePath(fullPath, currentPath()));
	};

	const navigate = (href: string) => {
		const fromPath = currentPath();
		const mappedHref = resolvePath(href, fromPath);
		setCurrentPath(mappedHref);
		window.history.pushState({ clickedHref: href, fileUrl: mappedHref }, '', mappedHref.webPath);
	};

	const handleClick = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		const anchor = target.closest('a');

		if (anchor && anchor.href && !anchor.target) {
			e.preventDefault();
			const rawHref = anchor.getAttribute('href');
			if (!rawHref) return;
			navigate(rawHref);
		}
	};

	window.addEventListener('popstate', handlePopState);
	document.addEventListener('click', handleClick);

	onCleanup(() => {
		window.removeEventListener('popstate', handlePopState);
		document.removeEventListener('click', handleClick);
	});

	return { currentPath, clickedHref, navigate, resolvePath };
}

interface RouteProps {
	router: RouterContext;
	resolver: (path: FileUrl) => JSX.Element;
}

export function Route(props: RouteProps) {
	return <>{props.resolver(props.router.currentPath())}</>;
}
