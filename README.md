# Webpage HTML Export

Exports an obsidian document as an HTML document / webpage / website, **(correctly!)** including all styling and formatting.

## Features:
- Generates an interactive document outline with your page and embeds it onto the site.
- Color theme toggle can be embedded anywhere on the page.
- Supports images, with automatic base64 inlining, or by exporting the images seperately.
- Supports inline CSS, or exporting seperately.
- Supports inline JS, or exporting JS seperately.
- Supports snippets, and custom themes (both light and dark).
- Interactivaly collapse and unfold headers

## To Use:

### General:
- Right click on the file in the file manager, on a tab, or open the file menu from the three dots.
- Select Export As HTML
- Change options
- Click Export, and select a location for the file

### Theme Toggle Note:
- If you want the theme toggle in a specific place be sure to write `\theme-toggle` in the place of the toggle in your document.
- If you do not the toggle will show at the top left of the webpage.

### Seperate Files Notes:
- If exporting files seperately they will all be but into the same folder as the .html file
- Images will be placed relative to the .html file simmilarly to how they were in obsidian.
- The exception to this is if the images were lower in the heirarchy than the .html file, in which case the images are placed in a `/image` directory.
- All references are links are updated automatically.

## Screenshots:

![image](https://user-images.githubusercontent.com/39423700/201829478-bfacc587-4da6-4746-ac44-a58458e086a7.png)

![image](https://user-images.githubusercontent.com/39423700/201829546-a99d1b71-dd1e-4a8c-a2b0-2ca8cc771a6f.png)

![image](https://user-images.githubusercontent.com/39423700/201829592-d9a95868-b5eb-45f6-abbe-bd7c43104023.png)

## To Do:
- Make sun and moon icons on theme toggle match the theme colors (not just b/w)
- Export folders or whole vaults at once
- Add mobile support for the outline (mdeia queries and popout menu)
- Make the theme not change to light automatically when printing.

## Future
- Support for embedding custom external css and js files.
- Add way to easily share the webpage / html file online (seperate plugin?)
- Add style setting support for theming outline and toggles.


# Credits
Thanks to https://github.com/darlal/obsidian-switcher-plus for reference for switching between tabs.
