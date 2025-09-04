console.log('Starting export script...');

(async () => {
	try {
		console.log('Enabling plugins...');
		await this.app.plugins.setEnable(true);

		console.log('Enabling export plugin...');
		await this.app.plugins.enablePlugin('webpage-html-export');
		const plugin = await this.app.plugins.getPlugin('webpage-html-export');

		if (process.env.EXPORT_ENTIRE_VAULT) {
			console.log('Exporting entire vault...');
			await plugin.exportVault('/output');
		} else {
			console.log('Exporting...');
			await plugin.exportDocker();
		}

		console.log('Exported');
	} finally {
		// Let the docker command complete, by killing the process
		console.log('Killing obsidian process');
		require('node:process').kill(process.pid, 'SIGKILL');
		console.log('Killed'); // Should never get here
	}
})();