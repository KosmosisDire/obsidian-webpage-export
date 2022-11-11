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

![image](https://user-images.githubusercontent.com/39423700/201362684-3287506e-5457-429e-bdd5-09fefeb4b5d9.png)

![image](https://user-images.githubusercontent.com/39423700/201362844-d64e0d03-3c8c-4f98-a5b1-45e530181f6f.png)

![image](https://user-images.githubusercontent.com/39423700/201350548-bafd781e-3687-4012-b818-65a7b7033a78.png)

## To Do:
- Remove app.css
- Add scrolling to the outline.
- Support custom css and js only for export
- Enable embedding css per plugin
- Add an export-current button to the sidebar
- Export folders or whole vaults at once
- Improve outline HTML layout so it can be more easily styled.

# Future
- Add way to share this webpage online with all features enabled.

# Credits
Thanks to https://github.com/darlal/obsidian-switcher-plus for reference for switching between tabs.
