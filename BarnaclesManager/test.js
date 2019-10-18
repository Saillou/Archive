const childProcess = require('child_process');

function getInfoDisk(path) {
	const ls = childProcess.spawnSync('df', [path, '--output=target,size,used,avail']);

	let resultLines = ls.stdout.toString().split('\n', 2);
	let res = resultLines[resultLines.length-1].replace(/ +/g, ' ').split(' ');

	// Format result
	var info = { Mount:'', Total:0, Used:0, Available:0 };
	if(res.length == 4) {
		info.Mount 	= res[0];
		info.Total	= parseInt(res[1]);
		info.Used 	= parseInt(res[2]);
		info.Available 	= parseInt(res[3]);
	}

	return info;
}

function mountSdCard() {
	childProcess.spawnSync('mount', ['/dev/mmcblk1p1', '/media/sd']);
}
function unmountSdCard() {
	childProcess.spawnSync('umount', ['/media/sd']);
}

console.log('Sd', getInfoDisk('/media/sd'));

mountSdCard();
console.log('Sd', getInfoDisk('/media/sd'));

unmountSdCard();
console.log('Sd', getInfoDisk('/media/sd'));

