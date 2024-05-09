
// the theme is loaded from local storage in a deffered inline script so it can be loaded before content is shown
// this handles "runtime" theme changes
export enum ThemeType
{
	Light = "light",
	Dark = "dark"
}

export class Theme 
{
	private themeToggle: HTMLInputElement;

	public constructor()
	{
		this.themeToggle = document.querySelector(".theme-toggle-input") as HTMLInputElement;
		this.themeToggle?.addEventListener("change", event =>
		{
			this.switchTheme();
		});
	}

	public switchTheme()
	{
		const current = localStorage.getItem("theme") as ThemeType;
		let opposite = current == ThemeType.Light ? ThemeType.Dark : ThemeType.Light;
		this.setTheme(opposite, false);
	}

	public setTheme(theme: ThemeType, instant: boolean = false)
	{
		let state = theme == ThemeType.Light;
		this.themeToggle.checked = state;

		let oldTransition = "";
		if (instant) 
		{	
			oldTransition = document.body.style.transition;
			document.body.style.transition = "none";
		}

		if(!this.themeToggle.classList.contains("is-checked") && state)
		{
			this.themeToggle.classList.add("is-checked");
		}
		else if (this.themeToggle.classList.contains("is-checked") && !state)
		{
			this.themeToggle.classList.remove("is-checked");
		}

		if(!state)
		{
			if (document.body.classList.contains("theme-light"))
			{
				document.body.classList.remove("theme-light");
			}

			if (!document.body.classList.contains("theme-dark"))
			{
				document.body.classList.add("theme-dark");
			}
		}
		else
		{
			if (document.body.classList.contains("theme-dark"))
			{
				document.body.classList.remove("theme-dark");
			}

			if (!document.body.classList.contains("theme-light"))
			{
				document.body.classList.add("theme-light");
			}
		}

		if (instant)
		{
			setTimeout(function()
			{
				document.body.style.transition = oldTransition;
			}, 100);
		}

		localStorage.setItem("theme", state ? "light" : "dark");
	}
}
