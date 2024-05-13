setTimeout(async () => {
    await this.app.plugins.setEnable(true);

	await this.app.plugins.enablePlugin('webpage-html-export');

	await this.app.plugins.getPlugin("webpage-html-export").exportDocker();

	const process = require('child_process');

	process.exec('pkill -9 1');
}, 5000);
