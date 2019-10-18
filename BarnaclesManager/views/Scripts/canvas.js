$(function() {
	// Init
	var canvas		= document.getElementById('canvas');
	var context 	= canvas.getContext("2d");
	var size 		= getDimension();
	var mouse 		= {'x':size.width/2,'y':size.height/2};
	var lastMouse	= {'x':size.width/2,'y':size.height/2};
	
	var logo 		= document.getElementById('Gazo');
	var logoJp 		= document.getElementById('GazoJp');
	
	drawGrid(mouse);
	
	// Loop
	var timer 		= setInterval(function() {
		drawGrid(mouse);
		
		lastMouse.x = mouse.x;
		lastMouse.y = mouse.y;	
	}, 50);
	
	// Events
	document.addEventListener("mousemove", function(event) {
		mouse.x = event.clientX;
		mouse.y = event.clientY;
	});
	
	// Functions
	function getDimension() {
		return {'width':canvas.offsetWidth, 'height':canvas.offsetHeight};
	}
	function adaptCanvas() {
		var dim = getDimension();
		
		canvas.width 	= dim.width;
		canvas.height 	= dim.height;
		
		return dim;
	}

	function _clock() {
		var date = new Date();
		return date.getMilliseconds() + 1000*date.getSeconds();	
	}
	function _rgb(r, g, b) {
		return "rgb(" + 255*r +", " + 255*g +", " + 255*b + ")";
	}
	function _ratioColor(color, c) {
		c *= 255;
		var r = color[0]/c;
		var g = color[1]/c;
		var b = color[2]/c;
		return _rgb(r, g, b);
	}

	function drawGrid(pos) {
		const COTE = 35;
		const SIZE = adaptCanvas();
		
		context.clearRect(0, 0, SIZE.width, SIZE.height);
		
		var w2 = SIZE.width/2,
			h2 = SIZE.height/2;
		
		var x0c = Math.ceil(w2/COTE),
			y0c = Math.ceil(h2/COTE);
		
		var power 	= (1+Math.sin(_clock()*6.28/2500.0))*0.0425+0.02;
		var rTot 	= (SIZE.width*SIZE.width + SIZE.height*SIZE.height);
		
		var xBloc = Math.floor(pos.x/COTE) - x0c,
			yBloc = Math.floor(pos.y/COTE) - y0c;
		
		for(let x = -x0c, xb = 0, yb = 0; x <= x0c; x++) {
			let dx = COTE*(x-xBloc);
			
			for(let y = -y0c; y <= y0c; y++) {
				let dy 		= COTE*(y-yBloc);
				let ratio 	= (dx*dx + dy*dy) / rTot;
				
				if(x == xBloc && y == yBloc)
					ratio += 0.0001;
				
				context.fillStyle = _ratioColor([37,40,48], Math.pow(ratio, power));
				context.fillRect(xb, yb, COTE-1, COTE-1);
				
				yb += COTE;				
			}
			xb += COTE;
			yb = 0;
		}
	}

});


