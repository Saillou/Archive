var G_autocomplete_actif = false;

$(function() {	
	// -- Objects definition --
	var Item = function(virtualDisk_, text_) {
		// - Public members
		this.virtualDisk = virtualDisk_;
		this.text = text_;
		this.parent = null;
		
		// - Private members
		var domEle 		= document.createElement('li');
		var domMatch 	= document.createElement('span');
		var domGuess 	= document.createElement('span');
		
		// - Constructions
		domEle.className 	= "autocompleteItem noMouse";
		domMatch.className 	= "match";
		
		domGuess.innerHTML = text_;
		
		domEle.appendChild(domMatch);
		domEle.appendChild(domGuess);
		
		// - Events		
		function clickOnElement(item) {
			if(!item.parent)
				return;
			
			// Rebuild text
			let text = '';
			for(let span of domEle.getElementsByTagName('span'))
				text += span.innerHTML;
			
			// Complete
			let input = item.parent.getElementsByTagName('input')[1];
			if(input)
				input.value = text;
		};
		
		// - Methods
		this.addTo = function(parent_) {
			// Parent
			if(this.parent)
				this.remove();
			
			this.parent = parent_;
			
			// Pos
			this.setPosition(parent_.childElementCount);
			this.parent.appendChild(domEle);
			
			// Events
			var self_ = this;
			$(domEle).mousedown(this, function(event) {
				clickOnElement(self_);
			});
			
		};
		this.remove = function() {
			// Events
			$(domEle).off();
			
			// Parent
			if(this.parent)
				this.parent.removeChild(domEle);
			
			this.parent = null;
		};
		this.match = function(input_) {
			// input_ (should be) = [virtual_disk]:/[input_path]
			let sliceInputPath 	= input_.split(':');
			let virtualDisk_ 	= sliceInputPath[0];
			let inputPath_ 		= sliceInputPath[sliceInputPath.length-1];
			
			if(virtualDisk_ != this.virtualDisk)
				return false;
			
			domMatch.innerHTML = this.text.substring(0, inputPath_.length);
			domGuess.innerHTML = this.text.substring(inputPath_.length);
			
			return (this.text.search(inputPath_) == 0); // TextSearch = BeginInputPath (position 0)
		};
		
		this.setPosition = function(i) {
			domEle.style.top = 35*i + "px";
		};
		this.setChoosen = function(isChoosen) {
			if(isChoosen)
				$(domEle).addClass('choosen');
			else
				$(domEle).removeClass('choosen');
		}
	};
	
	// -- Variables	
	const req 	= new XMLHttpRequest();
	
	var dom 	= document.getElementsByClassName('autocomplete');

	var numItemChoose = null;
	var items = [];
	
	// -- Events
	// Get server datas
	req.onreadystatechange = function(event) {
		if (this.readyState === XMLHttpRequest.DONE) {
			if (this.status === 200)
				reponseReceived(this.responseText);
			else 
				console.log("Status de la réponse: %d (%s)", this.status, this.statusText);
		}
	};
	req.open('GET', '/files', true);
	req.overrideMimeType("application/json");
	req.send(null);
	
	// Write
	$(document).on('keydown', function(ev) {
		if(ev.key == 'Enter') {		
			if(numItemChoose !== null)
				complete(numItemChoose);	
		}
		if(ev.key == 'Tab') {
			ev.preventDefault();
			
			complete(numItemChoose);	
		}
		if(ev.key == 'ArrowUp') {
			ev.preventDefault();	
			
			if(numItemChoose === null) // I want the next one to be the last of the list
				numItemChoose = 0;
			
			numItemChoose--;
			if(numItemChoose < 0) 
				numItemChoose += countItemPresent();
		}
		if(ev.key == 'ArrowDown') {
			ev.preventDefault();
			
			if(numItemChoose === null) // I want the next one to be the 0
				numItemChoose = -1;
			
			numItemChoose++;	
			numItemChoose %= countItemPresent();
		}
	});
	
	$(dom).on('focusin', function(ev) {	
		var virtual = this.getElementsByTagName('input')[0];
		var input 	= this.getElementsByTagName('input')[1];
		let inputPath = virtual.value + ':' + input.value;
		
		G_autocomplete_actif = true;	
		addMatchingItems(this, inputPath);
		setChoosen(numItemChoose);
	});
	$(dom).on('keyup', function(ev) {
		var virtual = this.getElementsByTagName('input')[0];
		var input 	= this.getElementsByTagName('input')[1];
		let inputPath = virtual.value + ':' + input.value;
	
		addMatchingItems(this, inputPath);
		
		var nNow = countItemPresent();
		if(numItemChoose >= nNow)
			numItemChoose = nNow-1;
		setChoosen(numItemChoose);
	});	
	$(dom).on('focusout', function(ev) {
		G_autocomplete_actif = false;
		clearItems();
		numItemChoose = null;
	});
	
	// Functions
	function reponseReceived(res) {
		// Add root directories
		items.push(new Item('system', '/'));
		items.push(new Item('sd', '/'));
		
		// Parse answer
		let parser = JSON.parse(res);
		depouille(parser.sys.ELEMENTS);
		depouille(parser.sd.ELEMENTS);
	}
	function depouille(datas) {		
		for(let data of datas) {
			if(data.type == ('folder')) {
				// path_ (should be) = [virtual_disk]:/[path]
				let sliceInputPath 	= data.path.split(':');
				let virtualDisk 	= sliceInputPath[0];
				let inputPath 		= sliceInputPath[sliceInputPath.length-1];
				
				items.push(new Item(virtualDisk, inputPath + data.name));
				depouille(data.children);
			}
		}
	}
	
	function complete(numChoose) {
		if(numItemChoose === null) // if null, it is normally cast in 0, but let's just be sure
			numChoose = 0;
		
		var num = 0;
		for(let item of items) {
			if(item.parent) {
				if(num == numChoose) {
					let input = item.parent.getElementsByTagName('input')[1];
					if(input)
						input.value = item.text;
					break;
				}
				else {
					num++;
					continue;
				}
			}
		}
	}
	
	function addMatchingItems(domAutocomplete, value) {
		for(let item of items) {
			if(item.match(value)) {
				if(!item.parent) 
					item.addTo(domAutocomplete);
			}
			else  {
				if(item.parent)
					item.remove();
			}
		}
		
		updatePositions();
	}
	
	function updatePositions() {
		var iPos = 1; // 1 because 0 is the text input
		
		for(let item of items) 
			if(item.parent) 
				item.setPosition(iPos++);
	}
	
	function setChoosen(idItem) {
		if(idItem === null) // if null, we want to select none
			idItem = -1; 
		
		var id = 0; 
		for(let item of items) {
			if(item.parent) {
				item.setChoosen(idItem == id);		
				id++;
			}
		}
	}
	
	function countItemPresent() {
		var n = 0;
		for(let item of items) 
			if(item.parent) 
				n++;
		return n;
	}
	
	function clearItems() {
		for(let item of items)
			item.remove();
	}
});
