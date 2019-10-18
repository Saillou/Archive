/* ---- Import libraries ---- */
const express 		= require('express');
var session 		= require("express-session");
var zip 		= require('express-zip');
const http		= require('http');
const fs 		= require('fs');
const tools 		= require(__dirname + '/tools');
const bodyParser 	= require('body-parser');
const childProcess	= require('child_process');

const PATH_SYS = __dirname + '/root';
const PATH_SD  = '/media' + '/sd';

/* ---- Define constantes ---- */
const PATH_CONFIG 	= __dirname + '/config';
const PATH_CONFIG_DEF 	= __dirname + '/configDefault';

const PORT_USED 	= 80;
const CONFIG_DEFAULT 	= tools.getConfig(PATH_CONFIG_DEF);

/* ---- Creating server ---- */
const app = express();	
const server = http.Server(app);

// Configuration
app.use(express.static(__dirname + '/views'));
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'Bongo cat',
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Mount sdcard
mountDevice('/dev/mmcblk1p1', PATH_SD);

// Launch
server.listen(PORT_USED);
console.log("Server [state] > Started.");

// Routes
app.get('/', indexCtrl);
app.post('/login', loginCtrl, indexCtrl);

app.get('/logout', function(req, result) {
	// --- Controlleur ---
	console.log('Logout loaded');
	
	req.session.destroy();
	result.redirect('/');
});
app.get('/general', function(req, result) {
	// --- Controlleur ---
	if(!req.session.identifiant) {
		result.redirect('/');
	}
	else {
		var config 	= tools.getConfig(PATH_CONFIG);
		var data 	= getGeneral(config);
		
		console.log('General loaded');
		result.render(__dirname +'/views/general.ejs', {'data':data, 'config':config.data()});
	}
});

app.get('/memory', memoryCtrl);
app.post('/memory', memoryFormCtrl, memoryCtrl);

app.get('/config', configCtrl);
app.post('/config', configFormCtrl, configCtrl);

app.get('/download', function(req, result) {
	if(req.session.identifiant && req.query) {
		var disk 	= req.query.Disk;
		var where 	= req.query.Where;
		var virtual	= disk == 'system' ? PATH_SYS : PATH_SD;
		var path	= virtual + where + req.query.Name;
		
		var stats	= fs.lstatSync(path);
		var isDir	= stats.isDirectory();
		
		
		if(!isDir) // easy, direct
			result.download(path);
		else { // harder, compress first
			var allFiles = extractFiles(getMemory(path+"/"));
			var list = [];
			
			console.log('Compress:');
			
			for(let file of allFiles) {
				// File path = [virtual]:[path]
				let virtualPath = file.path.split(':');
				let filePath = virtualPath[virtualPath.length-1];
				
				let fileAdded = {
					path: virtual+filePath+file.name, 
					name: filePath.replace(file.name, '')+file.name
				}
				list.push(fileAdded);
				console.log("Name: ", fileAdded.name);
			}
			
			result.zip(list, req.query.Name+".zip");
		}
	}
	else 
		result.redirect('/memory');
});

// Ajax
app.get('/files', function(req, result) {
	// --- Controlleur ---
	if(req.session.identifiant) {
		var memory_sys 		= getMemory(PATH_SYS + '/');
		var memory_sd 		= getMemory(PATH_SD + '/');
		
		result.end(JSON.stringify({'sys':memory_sys, 'sd':memory_sd}));
	}
	else {
		result.end(JSON.stringify({}));
	}
});
app.get('/actions', function(req, result) {
	// --- Controlleur ---
	var errors = [];
	
	if(req.session.identifiant && req.query) {
		// Analyse request
		var disk 	= req.query.Disk;
		var where 	= req.query.Where;
		var name 	= req.query.Name;
		var virtual	= disk == 'system' ? PATH_SYS : PATH_SD;
		var path	= virtual + where + name;
		console.log("Action: ", req.query.Action);
		
		// Setup answer
		var info;
		
		switch(req.query.Action) {
			case 'CreateFolder':	
				// Create with fs ..
				if(!fs.existsSync(path))
					fs.mkdirSync(path);
				else errors.push(tools.createError('Create', 'Folder with the same name already exists.'));
			break;
			
			case 'Move':
				// Move with fs ..
				var virtualDest = req.query.DiskTo == 'system' ? PATH_SYS : PATH_SD;
				var pathDest = virtualDest + req.query.To + name;
				
				if(!fs.existsSync(pathDest)) {
					if(virtualDest == virtual) // Move only
						fs.renameSync(path, pathDest);
					else { // Can't rename cross device
						// Need to check is there is enough space before copy
						let sizeAvailable = getInfoDisk(virtualDest).Available;

						if(sizeAvailable > sizeOf(path)) {
							if(fs.lstatSync(path).isDirectory()) {
								copyFolderRecursive(path, pathDest);
								deleteFolderRecursive(path);
							}
							else{
								fs.copyFileSync(path, pathDest);
								fs.unlinkSync(path);
							}
						}
						else errors.push(tools.createError('Move', 'Not enough space to move this element'));
					}
				}
				else errors.push(tools.createError('Move', 'Element with the same name already exists.'));
			break;
			
			case 'Rename':
				// Rename with fs ..
				var pathDest = virtual + where + req.query.New;
				
				if(!fs.existsSync(pathDest))
					fs.renameSync(path, pathDest);
				else errors.push(tools.createError('Rename', 'Element with the same name already exists.'));
			break;
			
			case 'Delete':
				// Delete with fs ..
				if(fs.existsSync(path)) {
					if(fs.lstatSync(path).isDirectory())
						deleteFolderRecursive(path);
					else
						fs.unlinkSync(path);
				}
				else errors.push(tools.createError('Delete', 'Element trying to be deleted does not exist.'));
			break;
			
			case 'Properties':	
				// Properties with fs ..
				if(fs.existsSync(path)) {
					info = createFileInfo(virtual+where, name);
					if(info.isDir) {
						let infoOfDir 	= {'length':0, 'size':0};
						var list 		= [];
						
						readDir(info.realPath+'/', list);
						infoDir(list, infoOfDir);
						
						info.length = infoOfDir.length;
						info.size 	= infoOfDir.size;
					}
				}
				else errors.push(tools.createError('Properties', 'Element does not exist.'));
			break;
			
			default:
				errors.push(tools.createError('Actions', 'Not known action.'));
			break;
		}
	}
	else {
		errors.push(tools.createError('Session', 'Not connected.'));
	}
	
	result.end(JSON.stringify({'Errors':errors, 'Information':info}));
});


// 404 
app.get('/*', function(req, result) {
	result.redirect('/');
});
app.post('/*', function(req, result) {
	result.redirect('/');
});


// Controleurs
function indexCtrl(req, result) {
	// --- Controlleur ---
	if(req.session.identifiant) {
		result.redirect('/general');
	}
	else {
		console.log('Index loaded');
		result.render(__dirname +'/views/index.ejs', {'error':req.error?req.error:false});		
	}
}
function loginCtrl(req, result, next) {
	// --- Controlleur ---
	console.log('Login loaded');
	
	if(!req.session.identifiant) {
		var config = tools.getConfig(PATH_CONFIG);
		
		if(req.body.identifiant == "admin" && req.body.password == config.get('password')) {
			req.session.identifiant = "admin";
		}
		else
			req.error = true;
	}
	
	next();
}

function memoryCtrl(req, result) {
	// --- Controlleur ---
	if(!req.session.identifiant)
		result.redirect('/');
	else {
		// Basic inputs
		var pathDisplay_sys = '/';
		var pathDisplay_sd = '/';
		
		// Is there a request (from the intercepter for example)
		var virtualDisk = (req.virtualDisk || '');
		var pathDisplay1 = (req.pathExplorer || '');
		var pathDisplay2 = (req.otherPathExplorer || '');
		
		// Formate paths display, adding / if necessary
		if(pathDisplay1.length == 0 || pathDisplay1[pathDisplay1.length-1] != '/')
			pathDisplay1 += '/';
		if(pathDisplay2.length == 0 || pathDisplay2[pathDisplay2.length-1] != '/')
			pathDisplay2 += '/';
		
		// Change basic inputs following the requests
		if(virtualDisk == 'system') {
			pathDisplay_sys = pathDisplay1;
			pathDisplay_sd = pathDisplay2;
		}
		if(virtualDisk == 'sd') {
			pathDisplay_sd = pathDisplay1;
			pathDisplay_sys = pathDisplay2;
		}
		
		// Finally get the memory corresponding to the paths
		var memory_sys 		= getMemory(PATH_SYS+pathDisplay_sys);
		var memory_sd 		= getMemory(PATH_SD+pathDisplay_sd);
		
		// Render all that
		var infoSys  = getInfoDisk(PATH_SYS);
		var infoSd  = getInfoDisk(PATH_SD);
		console.log('Memory loaded');
		result.render(__dirname +'/views/memory.ejs', {
			'SYS':{'ELEMENTS':memory_sys.ELEMENTS, 'path':pathDisplay_sys, 'virtualDisk':'system', 'valide':true}, 
			'SD':{'ELEMENTS':memory_sd.ELEMENTS, 'path':pathDisplay_sd, 'virtualDisk':'sd', 'valide':infoSys.Mount != infoSd.Mount}
		});
	}	
}
function memoryFormCtrl(req, result, next) {
	// --- Controlleur : Intercept form ---
	if(!req.session.identifiant)
		result.redirect('/');
	else if(!req.body.path || !req.body.otherPath ||!req.body.path || req.body.path.length < 2) // check field
		result.redirect('/memory');
	else { // Follow the url
		if(!req.body.up && req.body.path) {
			req.pathExplorer = req.body.path;
		}
		else { // Up button
			let ariane = req.body.path.split('/');
			req.pathExplorer = ariane.splice(0, ariane.length-2).join('/');
		}
		req.otherPathExplorer = req.body.otherPath;
		req.virtualDisk = req.body.virtualDisk;
		
		return next(); // Yield to primary controler
	}
}

function configCtrl(req, result) {
	// --- Controlleur ---
	if(!req.session.identifiant)
		result.redirect('/');
	else {
		var config 	= tools.getConfig(PATH_CONFIG);
		var tab 	= req.tab || 'Software';
		
		// --- Controlleur ---
		console.log('Configuration loaded');
		result.render(__dirname +'/views/config.ejs', {'displayedTab':tab,'config':config.data(), 'errors': req.errors ? req.errors : []});
	}	
}
function configFormCtrl(req, result, next) {
	// --- Controlleur ---
	if(!req.session.identifiant)
		result.redirect('/');
	else {
		var config 	= tools.getConfig(PATH_CONFIG);
		var form 	= tools.treatConfigForm(req.body, config, CONFIG_DEFAULT);
		
		if(!form.errors.length) {
			config.updateFrom(form.content);
			config.save(PATH_CONFIG);
		}
		req.errors 	= form.errors;
		req.tab 	= req.body.formName ? (req.body.formName == 'software' ? 'Software' : 'Panel') : 'Software';

		return next();
	}	
}


// Functions
function getGeneral(config) {
	var files = extractFiles(getMemory(PATH_SYS+'/'));

	files.sort(function(a, b) {
		if(a.date > b.date)
			return -1;
		if(a.date < b.date)
			return 1;
		return 0;
	});

	// ----- Recent activities ----
	var RECENT_ACTIVITIES = [];
	if(config.get('grapheType') == 'time') {
		// Create clusters
		var clusters = [];
		for(let i = 0, n = files.length; i < n; i++) {
			var d = new Date(files[i].date);
			var label = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + (d.getDate()+1);

			clusters[label] = (clusters[label] || 0) + files[i].size;
		}

		// Use clusters
		for(let label in clusters) {
			if(clusters.hasOwnProperty(label))
				RECENT_ACTIVITIES.push({'label':label, 'value':clusters[label]});
		}
	}
	else {
		// Direct use
		for(let i = 0, n = files.length; i < n; i++)
			RECENT_ACTIVITIES.push({'label':(1+i), 'value':files[i].size});
	}

	// ----- Memory usage ----
	var infoSys = getInfoDisk(PATH_SYS);

	var totalSys 		= infoSys.Total+1; // easy way to avoid /0 if bug appears
	var totalUsedSys 	= infoSys.Used;
	var totalAvailableSys	= infoSys.Available;
	var totalVideoSys 	= 0;
	for(let i = 0, n = files.length; i < n; i++) 
		totalVideoSys += files[i].size;

	var totalOtherSys = totalUsedSys - totalVideoSys;

	var SYS_USAGE = [
		{'label':'Other', 	'value':(totalOtherSys/totalSys).toFixed(2)},
		{'label':'Available', 	'value':(totalAvailableSys/totalSys).toFixed(2)},
		{'label':'Recordings', 	'value':(totalVideoSys/totalSys).toFixed(2)}
	];

	// Same for the sd card
	var infoSd  = getInfoDisk(PATH_SD);

	var totalSd = 0;
	var totalUsedSd = 0;
	var totalAvailableSd = 0;
	var totalVideoSd = 0;
	var totalOtherSd = 0;
	if(infoSd.Mount != infoSys.Mount) { // Sd is mount
		totalSd 	 = infoSd.Total;
		totalUsedSd	 = infoSd.Used;
		totalAvailableSd = infoSd.Available;
		totalVideoSd 	 = 0;

		// List file present
		let fileSd = extractFiles(getMemory(PATH_SD+'/'));
		for(let i = 0, n = fileSd.length; i < n; i++) 
			totalVideoSd += fileSd[i].size;

		totalOtherSd = totalUsedSd - totalVideoSd;
	}

	// Careful: totalSd is 0 when not mount
	var SD_CARD_USAGE = [
		{'label':'Other', 	'value': totalSd > 0 ? (totalOtherSd/totalSd).toFixed(2) 	: 0},
		{'label':'Available', 	'value': totalSd > 0 ? (totalAvailableSd/totalSd).toFixed(2) 	: 0},
		{'label':'Recordings', 	'value': totalSd > 0 ? (totalVideoSd/totalSd).toFixed(2) 	: 0}
	];
		
	// Result
	return {
		'SYS_USAGE':SYS_USAGE,
		'SD_CARD_USAGE':SD_CARD_USAGE,
		'RECENT_ACTIVITIES':RECENT_ACTIVITIES,
	}
}
function copyFolderRecursive(path, pathDest) {
  if (fs.existsSync(path)) {
    fs.mkdirSync(pathDest);
    fs.readdirSync(path).forEach(function(file, index) {
      var curPath = path + "/" + file;
      var curPathDest = pathDest +"/" + file;
      if (fs.lstatSync(curPath).isDirectory())
	copyFolderRecursive(curPath, curPathDest);
      else
	fs.copyFileSync(curPath, curPathDest);
    });
  }
}
function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index){
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}
function readDir(path, list) {
	if(!fs.existsSync(path))
		return;
	
	fs.readdirSync(path).forEach(fileName => {
		let infoFile = createFileInfo(path, fileName);
		infoFile.children = [];
		
		if(infoFile.isDir)
			readDir(infoFile.realPath+'/', infoFile.children);

		list.push(infoFile);
	});	
}
function getMemory(path = PATH_SYS + '/') {
	var elements = [];
	readDir(path, elements);
	elements.sort((eleA, eleB) => (eleB.type == "folder") - (eleA.type == "folder"));
	
	return {'ELEMENTS':elements};
}
function sizeOf(path) {
	var stats = fs.lstatSync(path);
	if(!stats.isDirectory())
		return stats.size;

	var list = [];
	readDir(path+'/', list);

	var info = {length:0, size:0};
	infoDir(list, info);
	return info.size;
}
function infoDir(list, info) {
	for(let ele of list) {
		if(ele.isDir && ele.children) {
			infoDir(ele.children, info);
		}
		else {
			info.length++;
			info.size += ele.size;
		}
	}
}
function createFileInfo(path, fileName) {
	var realPath	 	= path + fileName;
	var stats		= fs.lstatSync(realPath);
	var isDir		= stats.isDirectory();
	
	return {
		'realPath'	: realPath,
		'isDir'		: isDir,
		'type'		: isDir ? 'folder' : 'file', 
		'icon'		: isDir ? 'folder' : ((fileName.indexOf('.mp4') > -1 || fileName.indexOf('.avi')) > -1 ? 'video' : 'file'), 
		'name'		: fileName, 
		'path'		: path.replace(PATH_SYS+'/', 'system:/').replace(PATH_SD+'/', 'sd:/'), 
		'size'		: stats.size,
		'date'		: stats.mtime
	};
}
function extractFiles(memory) {
	var list = [];

	for(let element of memory.ELEMENTS) {
		if(element.type != "folder")
			list.push(element);
		else
			list = list.concat(extractFiles({'ELEMENTS':element.children}));
	}
	
	return list;
}

function getInfoDisk(path) {
	// Call df on path
	const process = childProcess.spawnSync('df', [path, '--output=target,size,used,avail']);
	
	// Format result
	let resultLines = process.stdout.toString().split('\n', 2); // Limit 2 sub (avoid blank \n)
	let res = resultLines[resultLines.length-1].replace(/ +/g, ' ').split(' '); // Multispace->space, then split by spaces.
	
	var info = {Mount:'', Total:0, Used:0, Available:0};
	if(res.length == 4) { // Normaly
		info.Mount = res[0];
		info.Total = 1000*parseInt(res[1]);
		info.Used  = 1000*parseInt(res[1]-res[3]);
		info.Available = 1000*parseInt(res[3]);
	}
	return info;
}
function mountDevice(pathDevice, pathMount) {
	const process = childProcess.spawnSync('mount', [pathDevice, pathMount]);
}
function unmountDevice(pathMount) {
	const process = childProcess.spawnSync('umount', [pathMount]);
}
