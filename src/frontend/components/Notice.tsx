import { createSignal, For, onCleanup } from "solid-js";

interface NoticeItem {
	id: number;
	message: string;
	visible: boolean;
}

const [notices, setNotices] = createSignal<NoticeItem[]>([]);
let noticeId = 0;

export function showNotice(message: string, duration: number = 5000) {
	const id = noticeId++;
	console.log(message);

	setNotices((prev) => [...prev, { id, message, visible: false }]);

	// Trigger slide-in animation
	setTimeout(() => {
		setNotices((prev) =>
			prev.map((n) => (n.id === id ? { ...n, visible: true } : n))
		);
	}, 10);

	// Auto-dismiss
	setTimeout(() => {
		dismissNotice(id);
	}, duration);

	return id;
}

export function dismissNotice(id: number) {
	setNotices((prev) =>
		prev.map((n) => (n.id === id ? { ...n, visible: false } : n))
	);

	// Remove from DOM after animation
	setTimeout(() => {
		setNotices((prev) => prev.filter((n) => n.id !== id));
	}, 500);
}

export function NoticeContainer() {
	return (
		<div class="notice-container">
			<For each={notices()}>
				{(notice) => (
					<div
						class="notice"
						classList={{ "notice-visible": notice.visible }}
						onClick={() => dismissNotice(notice.id)}
						innerHTML={notice.message}
					/>
				)}
			</For>
		</div>
	);
}
