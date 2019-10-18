$(function() {
	$('[data-toggle="tooltip"]').tooltip();
	
	// Get the DOM
	var objDocument = $(document);

	var divDatas 	= document.getElementById('_fullExplorer');
	var explorers 	= divDatas.getElementsByClassName('datas');
	var elements 	= divDatas.getElementsByClassName('explorerElement');

	var draggedObj 	= {'obj':null,'type':'none'};
	var imgDragged	= createDraggedImg();
	var actionsToDo = [];

	const req = new XMLHttpRequest();

	// Actions
	function sendToServer(action) {
		// Get server datas
		req.onreadystatechange = function(event) {
			if (this.readyState === XMLHttpRequest.DONE) {
				if (this.status === 200)
					reponseReceived(action, JSON.parse(this.responseText));
				else 
					console.log("Status de la réponse: %d (%s)", this.status, this.statusText);
			}
		};
		
		// Create request
		var urlGET = '/actions?';
		for(let label in action)
			urlGET += label + '=' + action[label] + '&';
		urlGET = urlGET.substr(0, urlGET.length-1); // Remove the last linking char
		
		req.open('GET', urlGET, true);
		req.overrideMimeType("application/json");
		req.send(null);
	}
	function reponseReceived(question, answer) {
		if(answer.Errors) {
			if(answer.Errors.length == 0) {
				// Action depends on the question
				switch(question.Action) {
				case'Properties':
					let info = answer.Information;
					$('#ModalLongTitle').html(info.name);
					
					const UNIT_PREFIX 	= ['', 'K', 'M', 'G', 'T'];
					let sizeLog 		= info.size > 0 ? Math.floor(Math.log10(info.size)/3) : 0;
					let sizeUnit 		= UNIT_PREFIX[Math.min(sizeLog, UNIT_PREFIX.length-1)];
					let sizeShow 		= Math.ceil(info.size/Math.pow(10,sizeLog*3)*100)/100;
					
					let content = "\t<ul>\n";
					content += "\t\t<li>" + "<strong>"+"Name: "+"</strong>" + info.name + "</li>\n";
					content += "\t\t<li>" + "<strong>"+"Path: "+"</strong>" + info.path + info.name + "</li>\n";
					content += "\t\t<li>" + "<strong>"+"Type: "+"</strong>" + info.type.replace(/^\w/, c => c.toUpperCase()) + "</li>\n";
					content += "\t\t<li>" + "<strong>"+"Icon: "+"</strong>" + info.icon.replace(/^\w/, c => c.toUpperCase()) + "</li>\n";
					content += "\t\t<li>" + "<strong>"+"Size: "+"</strong>" + sizeShow +" "+ sizeUnit + "B" + "</li>\n";
					if(info.isDir)
						content += "\t\t<li>" + "<strong>"+"Contains: "+"</strong>" + info.length + " files." + "</li>\n";
					content += "\t</ul>";

					$('#ModalLongBody').html(content);
					$('#modalCenter').modal(); // Show popup
				break;
					
				default:
					// Refresh
					let explorerId = "_" + question.Disk;
					
					for(let explorer of explorers) {
						if(explorer.parentNode.id == explorerId) {
							let domForm = explorer.parentNode.getElementsByTagName('form')[0];
							$(domForm).submit();
						}
					}
				}
			}
			else {
				var divError = document.getElementById('error_form');
				var list = document.getElementById('__list_error');
				$(list).empty();
				
				for(let error of answer.Errors) {
					var li = document.createElement('li');
					li.innerHTML = '<strong>' + error.position + '</strong>' + ' : ' + error.message;
					list.appendChild(li);
				}
				
				divError.style.display = 'block';
			}
		}
	}

	function drop(source, destination) {
		let nodeSrc = _nodeInfo(source);
		let nodeDes = _nodeInfo(destination);
		
		// Drop	
		sendToServer({
			'Action'	:	'Move', 
			'Disk'		:	nodeSrc.virtualDisk,
			'Where'		:	nodeSrc.basePath,
			'Name'		:	nodeSrc.name,
			'DiskTo'	:	nodeDes.virtualDisk,
			'To'		:	nodeDes.basePath + nodeDes.name +'/'
		});

		// Remove droppability
		_setOverDroppable(destination, false);
		_setOver(destination, true);
	}
	function activeEvent(emetteur, href) {
		var autorize = true;
		cleanCtxMenu();
		
		let nodeEmetteur = _nodeInfo(emetteur);
		
		var nameElement = '';
		var formulaire	= nodeEmetteur.root.getElementsByTagName('form')[0];

		if(nodeEmetteur.name)
			nameElement = nodeEmetteur.name; 
				
		if(href == '#Delete')
			autorize = confirm('Do you really want to delete this element ? This action cannot be undone.');
		
		if(href == '#Rename' || href == '#Create') {
			let indication, name;
			
			if(href == '#Rename') {
				indication 	= "New name: ";
				name 		= nameElement;
			}
			else { // Create
				indication 	= "Folder name: ";
				name 		= "New_Folder";
			}
			
			var newName = prompt(indication, name);
		}
		
		if(autorize) {
			if(newName != null && newName != "") {
				switch(href) {
					case '#Create':
						sendToServer({
							'Action'	:	'CreateFolder', 
							'Disk'		:	nodeEmetteur.virtualDisk,
							'Where'		:	nodeEmetteur.basePath,
							'Name'		:	newName
						});
					break;
					
					case '#Rename':
						sendToServer({
							'Action'	:	'Rename', 
							'Disk'		:	nodeEmetteur.virtualDisk,
							'Where'		:	nodeEmetteur.basePath,
							'Name'		:	nodeEmetteur.name,
							'New'		:	newName
						});
					break;
				}
			}	
			else {
				switch(href) {
					case '#Open':
						// Complete
						var input 	= nodeEmetteur.root.getElementsByTagName('input')[1];					
						input.value = nodeEmetteur.basePath + nodeEmetteur.name + '/';
						
						// Submit
						$(formulaire).submit();
					break;
					
					case '#Exit':
						// Complete
						var input 	= nodeEmetteur.root.getElementsByTagName('input')[1];
						var ariane 	= nodeEmetteur.basePath.split('/');
						
						input.value = ariane.splice(0, ariane.length-2).join('/');
						
						// Submit
						$(formulaire).submit();
					break;
					
					case '#Delete':
						sendToServer({
							'Action'	:	'Delete', 
							'Disk'		:	nodeEmetteur.virtualDisk,
							'Where'		:	nodeEmetteur.basePath,
							'Name'		:	nodeEmetteur.name
						});
					break;
					
					case '#Properties':
						sendToServer({
							'Action'	:	'Properties', 
							'Disk'		:	nodeEmetteur.virtualDisk,
							'Where'		:	nodeEmetteur.basePath,
							'Name'		:	nodeEmetteur.name
						});
					break;
					
					case '#Download':
						let url = '/download?Action=Download&Disk='+nodeEmetteur.virtualDisk+'&Where='+nodeEmetteur.basePath+'&Name='+nodeEmetteur.name;
						location = url;
					break;
				}
			}
		}
	}

	// Add Events
	for(let element of elements) {
		element.addEventListener('contextmenu', rightClick, false); // False: inner before outer (Can stop propagation before divParent)
		element.addEventListener('mousedown',  	mouseDown, false); // False: inner before outer (Can stop propagation before divParent)
		element.addEventListener('dblclick', 	doubleclick); 
	}

	for(let explorer of explorers)
		explorer.addEventListener('contextmenu', 	rightClick, false);

	document.addEventListener('mousedown', 		cleanse, false); // False: inner before outer (Element can stop propagation before here)
	document.addEventListener('mouseup', 		mouseUp);

	document.addEventListener('mousemove', function(event) {	
		var mouse = {'x':event.clientX + objDocument.scrollLeft(), 'y':event.clientY + objDocument.scrollTop()};
		
		imgDragged.style.left = mouse.x + "px";
		imgDragged.style.top = mouse.y + "px";
		
		routine(mouse);
	});

	// Define functions event
	function mouseOver(element) {
		if(_isSelected(element))
			return;

		var isFolder = _typeElement(element.firstElementChild) == 'Folder';	
		if(draggedObj.obj != null && draggedObj.obj != element && isFolder)
			_setOverDroppable(element, true);
		else
			_setOver(element, true);
	}
	function mouseOut(element) {	
		_setOver(element, false);
		_setOverDroppable(element, false);
	}

	function doubleclick(event) {
		return activeEvent(this, (_typeElement(this.firstElementChild) == 'Folder') ? '#Open' : '#Download');
	}
	function rightClick(event) {
		event.preventDefault();
		event.stopPropagation();
		
		adaptSelection(this);
		createMenu(this, {'x':event.clientX, 'y':event.clientY});
		
		return false;
	}

	function mouseDown(event) {
		var mouse = {'x':event.clientX + objDocument.scrollLeft(), 'y':event.clientY + objDocument.scrollTop()};
		event.stopPropagation();
		
		var isSelected = adaptSelection(this);
		cleanCtxMenu();
		routine(mouse);
		
		var type = _typeElement(this.firstElementChild);
		if(type == 'none') {
			draggedObj.obj = null;
			return;
		}
		
		draggedObj = {'obj':this, 'type':type};
		
		imgDragged.src	='../Resources/'+ type +'.png';
		// Show image if  mouse move
		actionsToDo.push({'event':'showDrag', 'target':event.currentTarget, 'mouse':mouse});
	}
	function mouseUp(event) {
		var mouse = {'x':event.clientX + objDocument.scrollLeft(), 'y':event.clientY + objDocument.scrollTop()};
		routine(mouse);
		
		if(draggedObj.obj == null)
			return;
		
		checkDragTarget(event);
		
		draggedObj = {'obj':null,'type':'none'};
		imgDragged.style.display = "none";
		
		// Remove events showDrag (if any)
		var i = actionsToDo.length;
		while (i--) {
			let action = actionsToDo[i];
			if(action.event == 'showDrag') 
				actionsToDo.splice(i, 1);
		}
	}


	// Checkings
	function routine(mouse) {
		// No diplay event when menu is here
		var menu = document.getElementById('ContextMenu');
		if(menu) 
			return;
		
		if(G_autocomplete_actif)
			return;
		
		// Mouse over/Out of elements
		for(let element of elements) {
			if(_isMouseIn($(element), mouse)) {
				mouseOver(element);
			}
			else {
				mouseOut(element);
			}
		}
		
		// Actions
		var i = actionsToDo.length;
		while (i--) {
			let action = actionsToDo[i];
			
			switch(action.event) {			
			case 'showDrag':
				let dx = (mouse.x - action.mouse.x);
				let dy = (mouse.y - action.mouse.y);
				if(dx*dx + dy*dy > 0) {
					imgDragged.style.display = "block";
					actionsToDo.splice(i, 1);
				}
				break;
			}
			
		}	
	}
	function checkDragTarget(event) {
		var mouse = {'x':event.clientX + objDocument.scrollLeft(), 'y':event.clientY + objDocument.scrollTop()};
		let node  = _nodeInfo(draggedObj.obj);
		
		// Folders ?
		for(let element of elements) {
			if(_isMouseIn($(element), mouse)) {
				if(_hasClass(element, 'explorerElement-over-droppable')) {
					drop(draggedObj.obj, element);
					cleanse();
					
					return; // Drop 1 time
				}	
				
				return; // Only over 1 element
			}
		}
		
		// Explorer	
		for(let explorer of explorers) {
			if(_isMouseIn($(explorer), mouse)) {
		
				if(explorer.parentNode.id != node.root.id) {
					drop(draggedObj.obj, explorer);
					cleanse();
					
					return; // Drop 1 time
				}
				
				return; // Only over 1 element
			}
		}
	}

	// Creation
	function createMenu(element, posMouse) {
		cleanCtxMenu();	


		// What actions ?
		var actionsToCreate = [];	
		if(!_hasClass(element, 'explorerElement')) {
			actionsToCreate.push({'Label':_addGlyphe("plus")+"Create folder", 		'Link':"#Create", 	'Pos':0}); 
			actionsToCreate.push({'Label':_addGlyphe("level-up")+"Exit folder", 	'Link':"#Exit", 	'Pos':1});
		}
		else {
			// What type is the element ?
			switch(_typeElement(element.firstElementChild)) {
				case 'Folder':
					actionsToCreate.push({'Label':_addGlyphe("folder-open")+"Open", 	 'Link':"#Open", 'Pos':0});
					actionsToCreate.push({'Label':_addGlyphe("download")+"Download all", 'Link':"#Download", 'Pos':0});
				break;
				
				case 'File':
					actionsToCreate.push({'Label':_addGlyphe("download")+"Download", 'Link':"#Download", 'Pos':0});
				break;
			}
			actionsToCreate.push({'Label':_addGlyphe("pencil")	+"Rename", 		'Link':"#Rename", 		'Pos':1});
			actionsToCreate.push({'Label':_addGlyphe("trash")	+"Delete", 		'Link':"#Delete", 		'Pos':2});
			actionsToCreate.push({'Label':_addGlyphe("list")	+"Properties", 	'Link':"#Properties", 	'Pos':3});
		}
		
		// Finally add all actions :
		var div = document.createElement('div');
		div.id = 'ContextMenu';
		div.style = '\
			left:'+(posMouse.x+10)+'px;\
			top:'+(posMouse.y)+'px;\
		';
		var ul = document.createElement('ul');
		
		actionsToCreate.sort((actA, actB) => actA.Pos - actB.Pos); 
		for(let action of actionsToCreate)
			appendMenuLink(action.Label, action.Link, ul, element);
		
		div.appendChild(ul);
		document.body.appendChild(div);
	}
	function appendMenuLink(text, href, parent, emetteur) {
		var li = document.createElement('li');
		var a = document.createElement('a');
		
		a.innerHTML = text;
		a.href 		= href;
		
		li.appendChild(a);
		parent.appendChild(li);
		
		$(a).on('mousedown', function() {
			activeEvent(emetteur, href);
		});
	}

	function createDraggedImg() {
		var imgDragged = document.createElement('img');
		imgDragged.width 	= 50;
		imgDragged.height 	= 50;
		imgDragged.id 		= "__dragDrop";
		imgDragged.className = 'dragImg noMouse';
		imgDragged.style.display = "none";
		
		document.body.appendChild(imgDragged);
		return imgDragged;
	}

	function cleanse(ev) {
		// Remove menu and deselect
		cleanCtxMenu();
		for(let element of elements) {
			if(_isSelected(element)) {
				_setSelected(element, false);
			}
		}	
		
		// Hide img
		imgDragged.style.display = "none";
	}
	function cleanCtxMenu() {
		var menu = document.getElementById('ContextMenu');
		if(menu) {
			$(menu).empty();
			document.body.removeChild(menu);
		}		
	}

	// Tools
	function _nodeInfo(source) {	
		var information = {root:'', virtualDisk:'', basePath:'', name:''};
		if(!source)
			return information;
		
		// Search source : explorer
		information.root = source;
		while(information.root && information.root.className != 'explorer')
			information.root = information.root.parentNode;
		
		// Safety
		if(!information.root)
			information.root = source;
		
		information.virtualDisk = information.root.getElementsByTagName('input')[0].value;
		information.basePath 	= information.root.getElementsByTagName('input')[1].value;
		
		// No name needed if over an explorer
		information.name		= (!_hasClass(source,'datas') && source.lastElementChild) ? source.lastElementChild.innerText : "";	
		
		return information;
	}

	function adaptSelection(_this) {
		var isSelected = _isSelected(_this);
		if(!isSelected) {
			// Select this one and unselect the others
			_setSelected(_this, true);
			
			for(let element of elements) {
				if(element == _this) 
					continue;
				
				if(_isSelected(element)) {
					_setSelected(element, false);
				}
			}
		}	
		
		return isSelected;
	}


	function _isSelected(el) {
		return _hasClass(el, 'selected');
	}
	function _setSelected(el, state) {
		return _setClass(el, state, 'selected');
	}
	function _setOver(el, state) {
		return _setClass(el, state, 'explorerElement-hover');
	}
	function _setOverDroppable(el, state) {
		return _setClass(el, state, 'explorerElement-over-droppable');
	}

	function _isMouseIn(jqObj, mouse) {
		if(!jqObj)
			return false;
		
		var offset = jqObj.offset();
		if(!offset)
			return false;
		
		let x = offset.left;
		let y = offset.top;
		let w = jqObj.width();
		let h = jqObj.height();

		return (mouse.x > x && mouse.x < x+w && mouse.y > y && mouse.y < y+h);
	}

	function _typeElement(el) {
		if(!el) 
			return 'none';
		else
			return _hasClass(el, '_file') ? 'File' : _hasClass(el, '_folder') ? 'Folder' : 'none';
	}
	function _hasClass(el, classStr) {
		result = false;
		
		if(el && el.className)
			result = el.className.split(' ').indexOf(classStr) > -1;
		
		return result;
	}
	function _setClass(el, state, classStr) {
		if(el && el.className) {
			var gottit = _hasClass(el, classStr);
			var classes = el.className.split(' ');
			
			if(state && !gottit)
				classes.push(classStr);
			else if(!state && gottit)
				classes.splice(classes.indexOf(classStr), 1);
			
			el.className = classes.join(' ');
		}		
	}
	function _addGlyphe(name) {
		return '<span class="fa fa-'+name+'"></span>   '
	}

});