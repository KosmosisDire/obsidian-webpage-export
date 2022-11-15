# Webpage HTML Export

Exports an obsidian document, folder, or vault as an HTML document / webpage / website, **(correctly!)** including all styling and formatting.

## Features:
- Export files, folders, or the whole vault as html.
- Color theme toggle can be embedded anywhere on the page. [Explained in: Theme Toggle](#theme-toggle)
- Supports images, with automatic base64 inlining, or by exporting the images seperately. [Explained in: Non-Inlined Files](#non-inlined-files)
- Supports inline CSS, or exporting seperately. [Explained in: Non-Inlined Files](#non-inlined-files)
- Supports inline JS, or exporting JS seperately. [Explained in: Non-Inlined Files](#non-inlined-files)
- Supports snippets, and custom themes (both light and dark).
- Interactively collapse and unfold headers like in obsidian
- Export documents with onclick attributes working. [Explained in: On Click Atrributes](#on-click-attributes)

## To Use:

### General:
- Right click on the file in the file manager, on a tab, or open the file menu from the three dots.
- Select Export As HTML
- Change options
- Click Export, and select a location for the file

### Theme Toggle:
- Any `theme-toggle` code block will be replaced with a toggle for changing the theme. That means:
> \`theme-toggle\`
> 
> \`\`\`theme-toggle\`\`\`

or

> \`\`\`theme-toggle
> 
> \`\`\`

- This toggle does not work inside of obsidian, however once exported it will (this may change in the future)
- If you do not include \`theme-toggle\` in a document and the `Add Dark Mode Toggle` setting is on then a toggle will be fixed to every page in the top left corner.

### Non-Inlined Files:
- If exporting CSS or JS seperately those files will be exported into the same folder as the .HTML
- Images will be placed relative to the .HTML file the same as they were in obsidian.
- The exception to this is if the images were lower in the heirarchy than the .HTML file, in which case the images are placed in a `/image` directory.
- All references and links to images or files are updated automatically.

### On Click Attributes
This is a somewhat niche feature; however, if you want to use the `onlick` attribute in your exported HTML without editing it afterwards you can use simple feature in this plugin to do that:
1. Replace the `onclick` attribute in your source with `data-onclick`.
2. Export the file, and this attribute will be replaced with onclick in the exported html.

Note: This does not enable `onclick` inside of obsidian itself. 

## Screenshots:

![image](https://user-images.githubusercontent.com/39423700/201829478-bfacc587-4da6-4746-ac44-a58458e086a7.png)

![image](https://user-images.githubusercontent.com/39423700/201829546-a99d1b71-dd1e-4a8c-a2b0-2ca8cc771a6f.png)

![image](https://user-images.githubusercontent.com/39423700/201829592-d9a95868-b5eb-45f6-abbe-bd7c43104023.png)


## To Do:
<!--
- Make sun and moon icons on theme toggle match the theme colors (not just b/w)
- Export folders or whole vaults at once
- Add mobile support for the outline (mdeia queries and popout menu)
- Make the theme not change to light automatically when printing.

## Future
- Support for embedding custom external css and js files.
- Add way to easily share the webpage / html file online (seperate plugin?)
- Add style setting support for theming outline and toggles.
-->

![image](https://user-images.githubusercontent.com/39423700/201869149-257d7136-9876-4c43-a19c-5826e4abdd1c.png)


## Contributing
- I am open to any PRs as long as they align with my vision for the plugin. So if you are going to work on a feature that isn't on the TO DO, then please submit an issue instead.
- When changing styles, you must set the `autoDownloadExtras` variable at the top of `main.ts` to `false`. This is to prevent the plugin from redownloading the extra styles and overwiting changes. Be sure to set this back once you're done testing, but then don't reload the plugin until you have commited your changes.
- Try to keep large scale reorganization of the code to a minimum, even though I know it is a **HUGE** mess right now. Small regoranizations and refactors are fine.

## Support Me
<a href="https://www.buymeacoffee.com/nathangeorge">
	<img src="https://raw.githubusercontent.com/KosmosisDire/obsidian-webpage-export/master/support-image.png" style="width:300px" />

## Credits
Thanks to https://github.com/darlal/obsidian-switcher-plus for reference for switching between tabs.
