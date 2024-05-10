setTimeout(() => {
    electron.ipcRenderer.sendSync("vault-open", "HTML Export", true);
    setTimeout(() => {
        console.log(electron);
    });
}, 1000);