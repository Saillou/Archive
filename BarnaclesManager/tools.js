// Requirement
const fs = require('fs');

// Final interface
module.exports = {
	getConfig: function(path) {
		return __getConfig(path);
	},
	treatConfigForm: function(body, config, CONFIG_DEFAULT) {
		return __treatConfigForm(body, config, CONFIG_DEFAULT);
	},
	createError: function(pos_, mes_) {
		return new Error(pos_, mes_);
	}
};


// Objects
var Config = function(configData_) {
	// Members
	var _data = configData_;
	
	// Getters
	this.data = function() {
		return _data;
	};
	
	this.get = function(label) {
		for(let d of _data) {
			if(d.label == label)
				return d.value;
		}
		return '';
	};
	this.set = function(label, value) {
		for(let d of _data) {
			if(d.label == label) {
				d.value = value;
				return true;
			}
		}
		return false;
	};
	
	// Methods
	this.updateFrom = function(form) {
		for(let d of form)
			this.set(d.label, d.value)
	};
	
	this.save = function(path) {
		return __saveConfig(path, this);
	};
};

var Pair = function(first_, second_){
	this.label = first_;
	this.value = second_;
}
var Error = function(pos_, mes_) {
	this.position = pos_;
	this.message = mes_;
}

// Private functions
function __getConfig(path) {
	return __readConfig(fs.readFileSync(path, 'utf8'));
}
function __readConfig(fileRaw) {
	var configData = [];
	
	// - Read file
	for(let line of fileRaw.split('\n')) {
		// Ignore comments
		var n = line.length;
		if(n<3 || line[0] == '#')
			continue;
		
		// Split clear lines
		var pair = line.replace(/['|"|\r]/g,'').split(':');
		
		// Ignore errors
		if(pair.length != 2)
			continue
		
		// Add new item
		configData.push(new Pair(pair[0], pair[1]));
	}
	
	// - Create config object
	var config = new Config(configData);
	
	return config;
}
function __saveConfig(path, config) {
	if(!config || !path)
		return false;
	
	var content = 
'# ---- CONFIGURATION ---- ##\n\
\n\
# Camera Preferences\n\
deviceName:"'+config.get('deviceName')+'"\n\
splitting:'+config.get('splitting')+'\n\
recording:'+config.get('recording')+'\n\
defaultPath:"'+config.get('defaultPath')+'"\n\
\n\
# Network\n\
password:'+config.get('password')+'\n\
\n\
# Panel Preferences\n\
grapheType:"'+config.get('grapheType')+'"\n\
grapheSize:'+config.get('grapheSize')+'\n\
';

	fs.writeFileSync(path, content, 'utf8');
	return true;
}

function __checkNetworkName(name) {
	for(let c of name) {
		if(c >= '0' && c <= '9') // Digit : ok
			continue;
			
		if(c >= 'A' && c <= 'Z') // A-Z : ok
			continue;
			
		if(c >= 'a' && c <= 'z') // a-z : ok
			continue;
			
		if(c == '-' || c == '_') // - and _ : ok
			continue;
			
		// Everything else : nope.
		return false;
	}
	return true;
}
function __treatConfigForm(body, config, CONFIG_DEFAULT) {
	var reset		= body.reset !== undefined;
	var errors 		= [];
	var formContent = [];
	
	if(body) {
		switch(body['formName']) {
			case 'software':
				// Text input - Name
				if(body.deviceName)
					if(!reset && !(__checkNetworkName(body.deviceName))) // ascii char : 'a-Z','0-9','-,_' only
						errors.push(new Error('Network name', "Only ascii chars such as 'a-Z','0-9' and '- or _'."));
						
				if(!errors.length && (body.deviceName || reset))
					formContent.push(new Pair('deviceName', reset ? CONFIG_DEFAULT.get('deviceName') : body.deviceName));
				else if(!body.deviceName)
					errors.push(new Error('Network name', "Not defined."));
				
				// Text input - Path
				if(body.path) 
					if(!reset && !(fs.existsSync(__dirname + '/root' + body.path)))
						errors.push(new Error('Default path', "This folder doesn't exist."));
						
				if(!errors.length && (body.path || reset))
					formContent.push(new Pair('defaultPath', reset ? CONFIG_DEFAULT.get('defaultPath') : body.path));
				else if(!body.path)
					errors.push(new Error('Default path', "Not defined."));
				
				// Checkboxes
				formContent.push(new Pair('splitting', reset ? CONFIG_DEFAULT.get('splitting') : (body.splittingCheck == 'on' ? 'True' : 'False')));
				formContent.push(new Pair('recording', reset ? CONFIG_DEFAULT.get('recording') : (body.recordingCheck == 'on' ? 'True' : 'False')));
				
			break;
			
			case 'password':
				// Previous password ok
				if(config.get('password') != body.currentPassword)
					errors.push(new Error('Password', "The current password is different."));
				
				// New not null, et confirmed
				if(!(body.newPassword && body.newPassword.length > 1 && body.newPassword == body.confirmPassword))
					errors.push(new Error('New password', "The new password and the confirmation are different."));
				
				if(!errors.length)
					formContent.push(new Pair('password', body.newPassword));
			break;
			
			case 'preferences':
				// Text input
				if(body.grapheSize)
					if(!reset && !(parseInt(body.grapheSize) >= 0)) // Avoid NaN
						errors.push(new Error('Graphe size', "The size entered isn't valid."));
					
				if(!errors.length && (body.grapheSize || reset))
					formContent.push(new Pair('grapheSize', reset ? CONFIG_DEFAULT.get('grapheSize') : parseInt(body.grapheSize)));
				else
					errors.push(new Error('Graphe size', "Not defined."));
				
				// Radio
				if(body.grapheType) 
					if(!reset && (body.grapheType != "time" && body.grapheType != "video"))
						errors.push(new Error('Graphe type', "The type checked isn't correct."));
					
				if(!errors.length && (body.grapheType || reset))
					formContent.push(new Pair('grapheType', reset ? CONFIG_DEFAULT.get('grapheType') : body.grapheType));
				else
					errors.push(new Error('Graphe type', "Not defined."));
				
			break;
			
			default:
				errors.push(new Error('Formulaire', "This form has not taget defined."));
			break;
		}
	}
	
	return {'errors': errors, 'content':formContent};
}

