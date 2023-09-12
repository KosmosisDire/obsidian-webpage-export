# Webpage HTML Export

Webpage HTML Export is a plugin for Obsidian which lets you export single files or whole vaults as HTML websites / webpages. It is similar to publish, but you get the .html files to do whatever you want with. Its goal is to support as many features of obsidian possible including themes, dataview, graph view, and more.

![image](https://github.com/KosmosisDire/obsidian-webpage-export/assets/39423700/bbb97fda-7a11-4b47-9e54-efc5e907d51f)

![image](https://github.com/KosmosisDire/obsidian-webpage-export/assets/39423700/0079b11a-45c1-4c36-a6d5-bad5bc229905)


## Features:
- Export files, folders, or the whole vault as html
- Export each document as a single .html file for document sharing
- Or export with embedded content exported externally for fast loading on the web
- Note table of contents / outline
- Vault explorer
- Theme Toggle
- Interactive Graph View (Experimental)

## Installation

Install from Obsidian Community Plugins: [Open in Obsidian](https://obsidian.md/plugins?id=webpage-html-export)

### Manual Installation

1. Download the `.zip` file from the [Latest Release](https://github.com/KosmosisDire/obsidian-webpage-export/releases/latest), or from any other release version.
2. Unzip into: `{VaultFolder}/.obsidian/plugins/`
3. Reload obsidian

## Using the Plugin
- To export a single file or folder, right click on the file or open the more-options menu for the file and select "Export to HTML".
- If you are exporting to a website please choose the "Multi-File Website" preset.
- If you are sharing a small number of files to be opened locally on a user's machine select the "Self-contained Documents" option.
- To further configure the export click the settings button on the bottom right of the export modal.
- When you are ready select "Export"
- Select a folder to export into. If you are exporting a folder or vault it is preferable that this folder is empty.
- Wait for the export to finish and do not minimize both obsidian and the export window simulateously or the export will pause.
- Congrats on your exported files!

## FAQ

> Q: Can I run this from the command line?
>
> A: Not yet. However a command line / CLI feature is planned. Contribute to the disscussion [here](https://github.com/KosmosisDire/obsidian-webpage-export/issues/49)

> Q: Why am I getting a fatal error that ":has" is not a valid selector?
> 
> A: You need to update obsidian to the latest version by downloading the new installer from obsidian's website. Both the installer version and current version need to be updated, so you actually have to go to obsidian.md and download the installer from there again.

> Q: Why won't the graph view load?
> 
> A: The graph view does not work if you are opening the files locally, you must host them on a web server.

> Q: Why are my pages loading so slow when hosted on a web server?
> 
> A: Make sure you select the "Multi-file Website" preset, or disable all the media inlining options in the settings.

## Contributing

Only start work on features which have an issue created for them and have been accepted by me!
Contributiong guide coming soon.

## Support This Plugin

This plugin takes a lot of work to maintain and continue adding features. If you want to fund the continued development of this plugin you can do so here:

<a href="https://www.buymeacoffee.com/nathangeorge"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=nathangeorge&button_colour=6a8695&font_colour=ffffff&font_family=Poppins&outline_colour=000000&coffee_colour=FFDD00"></a>

or if you prefer paypal: 

<a href="https://www.paypal.com/donate/?business=HHQBAXQQXT84Q&no_recurring=0&item_name=Hey+%F0%9F%91%8B+I+am+a+Computer+Science+student+working+on+obsidian+plugins.+Thanks+for+your+support%21&currency_code=USD"><img src="https://pics.paypal.com/00/s/MGNjZDA4MDItYzk3MC00NTQ1LTg4ZDAtMzM5MTc4ZmFlMGIy/file.PNG" style="width: 150px;"></a>
