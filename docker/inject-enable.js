setTimeout(async () => {
    await this.app.plugins.setEnable(true);

	await this.app.plugins.enablePlugin('webpage-html-export');

	try {
		await this.app.plugins.getPlugin("webpage-html-export").exportDocker();
	} catch(_) {
		const plugin = (await this.app.plugins.getPlugin('webpage-html-export'));

		const temp = plugin.settings.exportPath;
		plugin.settings.exportPath = '/output';
		await this.app.commands.executeCommandById('webpage-html-export:export-html-vault')

		plugin.settings.exportPath = temp;
	}

	const process = require('child_process');

	process.exec('pkill -9 1');
}, 5000);
