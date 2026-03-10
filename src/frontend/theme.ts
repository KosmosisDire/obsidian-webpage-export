export enum ThemeType {
	Light = "light",
	Dark = "dark",
}

export class Theme {
	private themeToggle: HTMLInputElement;

	constructor() {
		this.themeToggle = document.querySelector(".theme-toggle-input") as HTMLInputElement;
		this.themeToggle?.addEventListener("change", () => this.switchTheme());
	}

	switchTheme() {
		const current = localStorage.getItem("theme") as ThemeType;
		const opposite = current === ThemeType.Light ? ThemeType.Dark : ThemeType.Light;
		this.setTheme(opposite, false);
	}

	setTheme(theme: ThemeType, instant: boolean = false) {
		const isLight = theme === ThemeType.Light;
		this.themeToggle.checked = isLight;

		let oldTransition = "";
		if (instant) {
			oldTransition = document.body.style.transition;
			document.body.style.transition = "none";
		}

		this.themeToggle.classList.toggle("is-checked", isLight);
		document.body.classList.toggle("theme-light", isLight);
		document.body.classList.toggle("theme-dark", !isLight);

		if (instant) {
			setTimeout(() => { document.body.style.transition = oldTransition; }, 100);
		}

		localStorage.setItem("theme", isLight ? "light" : "dark");
	}
}
