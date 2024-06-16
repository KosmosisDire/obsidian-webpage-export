setTimeout(async () => {
    await this.app.plugins.setEnable(true);

	await this.app.plugins.enablePlugin('webpage-html-export');

	try {
		await this.app.plugins.getPlugin("webpage-html-export").exportDocker();
	} catch(_) {
		await this.app.commands.executeCommand('webpage-html-export:export-html-vault')
	}

	const process = require('child_process');

	process.exec('pkill -9 1');
}, 5000);
