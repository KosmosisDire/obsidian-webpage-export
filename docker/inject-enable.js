setTimeout(async () => {
    await this.app.plugins.setEnable(true);

	await this.app.plugins.enablePlugin('webpage-html-export');

	const plugin = await this.app.plugins.getPlugin('webpage-html-export');

	try {
		await plugin.exportDocker();
	} catch(_) {
		const temp = plugin.settings.exportPath;
		plugin.settings.exportPath = '/output';

		await this.app.commands.commands['webpage-html-export:export-html-vault'].callback()

		plugin.settings.exportPath = temp;
	}

	const process = require('child_process');

	process.exec('pkill -9 1');
}, 5000);
