jQuery(function()
{
    
    if (localStorage.getItem("theme_toggle") != null)
    {
        if (localStorage.getItem("theme_toggle") == "true")
        {
            $(".toggle__input").prop("checked", true);
            $("body").addClass("theme-light");
            $("body").removeClass("theme-dark");
        }
    }

    if (localStorage.getItem("theme_toggle") == null && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
    {
        $(".toggle__input").prop("checked", true);
        $("body").addClass("theme-light");
        $("body").removeClass("theme-dark");
        localStorage.setItem("theme_toggle", "true");
    }

    $(".toggle__input").on("click", function()
    {
        $('body').toggleClass('theme-light');
        $('body').toggleClass('theme-dark');

        if (localStorage.getItem("theme_toggle") == "true")
        {
            localStorage.setItem("theme_toggle", "false");
        }
        else
        {
            localStorage.setItem("theme_toggle", "true");
        }

        $(".toggle__input").prop("checked", localStorage.getItem("theme_toggle") == "true");
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        let newColorScheme = event.matches ? "theme-dark" : "theme-light";

        if (newColorScheme == "theme-dark")
        {
            $("body").addClass("theme-dark");
            $("body").removeClass("theme-light");
            $(".toggle__input").prop("checked", false);
            localStorage.setItem("theme_toggle", "false");
        }

        if (newColorScheme == "theme-light")
        {
            $("body").addClass("theme-light");
            $("body").removeClass("theme-dark");
            $(".toggle__input").prop("checked", true);
            localStorage.setItem("theme_toggle", "true");
        }
    });
});