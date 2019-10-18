/* Create variable global config */
var config = {
	// Members
	_data: '',
	
	// Getters
	data: function() {
		return this._data;
	},
	get: function(label) {
		for(let d of this._data) {
			if(d.label == label)
				return d;
		}
		return {'label':label, 'value':''};
	}
};

/* Encapsule the way to create it */
$(function() {
	var configData = [];
	for(input of $('#__CONFIG input')) {
		configData.push({'label':input.name, 'value':input.value});
	}
	
	config._data = configData;
});