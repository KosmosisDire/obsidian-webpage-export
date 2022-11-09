jQuery(function()
{
    // THEME TOGGLE
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

    // MAKE CALLOUTS COLLAPSIBLE
    // if the callout title is clicked, toggle the display of .callout-content
    $(".callout.is-collapsible .callout-title").on("click", function()
    {
        var isCollapsed = $(this).parent().hasClass("is-collapsed");

        if (isCollapsed)
        {
            $(this).parent().toggleClass("is-collapsed");
        }

        $(this).parent().find(".callout-content").slideToggle(duration = 100, complete = function()
        {
            if (!isCollapsed)
            {
                $(this).parent().toggleClass("is-collapsed");
            }
        });
    });

    

    // MAKE HEADERS COLLAPSIBLE
    // if "heading-collapse-indicator" is clicked, toggle the display of every div until the next heading of the same or lower level

    function getHeadingContentsSelector(header)
    {
        let headingLevel = header.parent().prop("tagName").toLowerCase();
        let headingNumber = parseInt(headingLevel.replace("h", ""));

        let endingHeadings = [1, 2, 3, 4, 5, 6].filter(function(item)
        {
            return item <= headingNumber;
        }).map(function(item)
        {
            return `div:has(h${item})`;
        });

        let endingHeadingsSelector = endingHeadings.join(", ");

        return endingHeadingsSelector;
    }


    $(".heading-collapse-indicator").on("click", function()
    {
        var isCollapsed = $(this).parent().parent().hasClass("is-collapsed");
        
        $(this).parent().parent().toggleClass("is-collapsed");

        let selector = getHeadingContentsSelector($(this));

        if(isCollapsed)
        {
            $(this).parent().parent().nextUntil(selector).each(function()
            {
                $(this).show();
            });
            
            $(this).parent().parent().nextUntil(selector).each(function()
            {
                if ($(this).hasClass("is-collapsed"))
                {
                    let s = getHeadingContentsSelector($(this).children().first().children().first());
                    $(this).nextUntil(s).hide();
                }
            });
        }
        else
        {
            $(this).parent().parent().nextUntil(selector).hide();
        }
    });

});