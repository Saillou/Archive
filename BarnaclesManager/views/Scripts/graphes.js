$(function() {	
	/* -- Get style -- */
	const COLOR_B_MID 	= "rgb(12,73,97)";
	const COLOR_B_HIGH 	= addColor(COLOR_B_MID, -8, -13, -20);
	const COLOR_B_LOW 	= addColor(COLOR_B_MID, 8, 17, 20);
	
	const UNIT_PREFIX = ['', 'K', 'M', 'G', 'T'];
	
	// Parsing data
	function fromData(elements, parse = false) {
		var tab = [];
		for(el of elements)
			tab.push({'label':el.name,'value': parse ? parseFloat(el.value) : el.value});
		return tab;
	}
	
	/* Dom */
	var cnvHisto = document.getElementById('__activities').getElementsByTagName('canvas')[0];
	var domDataAct 	= document.getElementById('__ACTIVITIES').getElementsByTagName('input');

	var ctxHisto = cnvHisto.getContext("2d");
	
	/* Datas */
	var RECENT_ACTIVITIES = fromData(domDataAct, true);

	// For normalized activities values
	var MAX_VALUE_ACTIVITY = 0;
	for(let act of RECENT_ACTIVITIES)
		MAX_VALUE_ACTIVITY = Math.max(act.value, MAX_VALUE_ACTIVITY);

	let highVal = (0.6/0.75)*MAX_VALUE_ACTIVITY;
	let lowVal = (0.4/0.75)*MAX_VALUE_ACTIVITY;
	
	let hvLog = highVal > 0 ? Math.floor(Math.log10(highVal)/3) : 0;
	let lvLog = lowVal > 0 ? Math.floor(Math.log10(lowVal)/3) : 0;
	
	let highUnit 	= UNIT_PREFIX[Math.min(hvLog, UNIT_PREFIX.length-1)];
	let lowUnit 	= UNIT_PREFIX[Math.min(lvLog, UNIT_PREFIX.length-1)];
	
	let highValShow = Math.ceil(highVal/Math.pow(10,hvLog*3)*100)/100;
	let lowValShow = Math.ceil(lowVal/Math.pow(10,lvLog*3)*100)/100;
	
	
	var dataLegendHisto = [
		{	
			'label':"> "+highValShow+" "+highUnit+"B", 	
			'color':COLOR_B_HIGH
		},
		{	
			'label':"<>", 	
			'color':COLOR_B_MID
		},
		{	
			'label':"< "+lowValShow+" "+lowUnit+"B", 
			'color':COLOR_B_LOW
		}
	];

	var ACTIVITIES_DRAWN 	= [];

	cnvHisto.addEventListener("mouseout", draw);
	cnvHisto.addEventListener("mousemove", function(event) {
		var objDocument = $(document);
		var objHisto 	= $(cnvHisto);
		var mouse 		= {'x':event.clientX + objDocument.scrollLeft(), 'y':event.clientY + objDocument.scrollTop()};

		const WIDTH = cnvHisto.width;
		const HEIGHT = cnvHisto.height;
		
		// Reticule X
		draw();
		
		// ctxHisto.lineWidth = 4;
		ctxHisto.strokeStyle = "rgb(95, 95, 100)";
		ctxHisto.fillStyle = "rgb(95, 95, 100)";
		
		var posX = mouse.x - objHisto.offset().left;
		var posY = mouse.y - objHisto.offset().top;
		
		const M_H = HEIGHT*0.85;
		const m_H = HEIGHT*0.10;
		if(posY < M_H && posY > (m_H-15)) {
			ctxHisto.beginPath();
			ctxHisto.moveTo(0, posY);
			ctxHisto.lineTo(cnvHisto.width, posY);
			ctxHisto.stroke();
			
			var value = Math.ceil(MAX_VALUE_ACTIVITY*(M_H-posY)/(M_H - m_H))/1000000;
			ctxHisto.fillText(value + "(MB)", 25, posY-10);
		}
		
		drawInfos(event, false);
	});

	/* Start */
	draw();

	/* Drawing */
	function draw() {
		adaptSize();
		clear();
		
		drawHisto();
	}
	
	function drawInfos(event, reDraw = true) {
		var objDocument = $(document);
		var objHisto 	= $(cnvHisto);
		
		var mouse 		= {'x':event.clientX + objDocument.scrollLeft(), 'y':event.clientY + objDocument.scrollTop()};
		var poppup 		= {'exist':false, 'context':null, 'posX':null, 'posY':null, 'content':null};

		// Intersections activities
		for(let activity of ACTIVITIES_DRAWN) {
			if(poppup.exist)
				break;
			
			let x = activity.Param.x + objHisto.offset().left;
			let y = activity.Param.y + objHisto.offset().top;

			if(x < mouse.x && x + activity.Param.w >= mouse.x) {
				if(y < mouse.y && y + activity.Param.h >= mouse.y) {
					poppup.exist = true;
					poppup.context = ctxHisto;
					poppup.posX = mouse.x - objHisto.offset().left;
					poppup.posY = mouse.y - objHisto.offset().top - 15;
					poppup.content = activity.Data.label;
				}
			}
		}	
		
		// Draw
		if(reDraw)
			draw();
		if(poppup.exist) {
			var orientation = 0;
			if(poppup.posX > poppup.context.canvas.width*0.85)
				orientation = -1;
			
			var poppupWidth = poppup.context.measureText(poppup.content).width+13;
			
			poppup.context.font="15px Arial";
			
			poppup.context.fillStyle = 'rgb(2, 2, 5, 0.6)';
			poppup.context.fillRect(poppup.posX + orientation*(poppupWidth+20)+15, poppup.posY, poppupWidth, 30);
			
			poppup.context.fillStyle = 'rgb(225, 225, 225)';
			poppup.context.fillText(poppup.content, poppup.posX + orientation*(poppupWidth+20)+20, poppup.posY+15);
		}
	}
	
	function drawLegend(ctx, datas, rect) {
		ctx.fillStyle = 'rgba(180,180,180, 0.3)';
		ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
		
		if(datas.length < 1)
			return;
		
		var rowH = rect.height / datas.length;
		for(let i = 0; i < datas.length; i++) {
			drawLegendItem(ctx, datas[i], {'x':rect.x,'y':i*rowH, 'width':rect.width, 'height':rowH});
		}
	}
	function drawLegendItem(ctx, data, rect) {
		var lineHeight = rect.y + rect.height/2;
		
		ctx.fillStyle = data.color;
		ctx.fillRect(rect.x+10, lineHeight-10/2, 10, 10);
		
		ctx.font="15px Arial";
		ctx.fillStyle = 'black';
		ctx.textBaseline='middle'; 
		ctx.fillText(data.label, 25+rect.x, lineHeight);
	}
	function drawHisto() {
		const WIDTH = cnvHisto.width;
		const HEIGHT = cnvHisto.height;
		
		const NB = Math.min(parseInt(config.get('grapheSize').value), RECENT_ACTIVITIES.length);
		const SIZE = (WIDTH-20)/NB;
		
		for(let i = 0; i < NB; i++) {
			let h = (RECENT_ACTIVITIES[i].value/MAX_VALUE_ACTIVITY)*HEIGHT*0.75;
			let x = 10+i*SIZE;
			let y = HEIGHT*0.85-h;
			let w = SIZE*0.8;
			
			ctxHisto.beginPath();
			ctxHisto.rect(x, y, w, h);

			if(h < 0.4*HEIGHT) 
				ctxHisto.fillStyle = COLOR_B_HIGH;
			else if(h < 0.6*HEIGHT) 
				ctxHisto.fillStyle = COLOR_B_MID;
			else 
				ctxHisto.fillStyle = COLOR_B_LOW;
			
			ctxHisto.fill();
			
			ACTIVITIES_DRAWN.push({
				'Shape'	: 'rect', 
				'Param'	: {'x':x, 'y':y, 'w':w, 'h':h}, 
				'Data'	: RECENT_ACTIVITIES[i]
			});
		}
		
		drawAxesHisto();
		drawLegend(ctxHisto, dataLegendHisto, {'x':WIDTH-140, 'y':0, 'width':140, 'height':100});
	}

	function drawAxesHisto() {
		const WIDTH = cnvHisto.width;
		const HEIGHT = cnvHisto.height;	
		
		ctxHisto.font="15px Arial";
		ctxHisto.strokeStyle = "rgb(210,210,210)";
		ctxHisto.fillStyle 	 = "rgb(150,150,150)";
		
		// -- Ordonnees
		// Draw axe
		ctxHisto.beginPath();
		ctxHisto.moveTo(10, HEIGHT*0.85+10);
		ctxHisto.lineTo(10, 10);
		ctxHisto.stroke();

		// Draw arrow
		ctxHisto.beginPath();
		ctxHisto.moveTo(5, 10);
		ctxHisto.lineTo(10, 5);
		ctxHisto.lineTo(15, 10);
		ctxHisto.fill();
		
		// Label
		ctxHisto.fillText('Size (MB)', 20, 15);
		
		// -- Abscices
		// Draw axe
		ctxHisto.beginPath();
		ctxHisto.moveTo(0, HEIGHT*0.85);
		ctxHisto.lineTo(WIDTH-5, HEIGHT*0.85);
		ctxHisto.stroke();
		
		// Draw arrow
		ctxHisto.beginPath();
		ctxHisto.moveTo(WIDTH-5, 	HEIGHT*0.85-5);
		ctxHisto.lineTo(WIDTH, 		HEIGHT*0.85);
		ctxHisto.lineTo(WIDTH-5, 	HEIGHT*0.85+5);
		ctxHisto.fill();
		
		// Label
		if(config.get('grapheType').value == 'time')
			ctxHisto.fillText('Time (Days)', WIDTH-ctxHisto.measureText('Time (Days)').width, HEIGHT*0.85+20);
		else
			ctxHisto.fillText('File (#)', WIDTH-ctxHisto.measureText('File (#)').width, HEIGHT*0.85+20);
	}

	/* Tools */
	function adaptSize() {
		cnvHisto.width 	= cnvHisto.offsetWidth;
		cnvHisto.height = cnvHisto.width/3;
	}
	function clear() {
		ACTIVITIES_DRAWN 	= [];
		
		ctxHisto.clearRect(0, 0, cnvHisto.width, cnvHisto.height);
	}
	function addColor(strColor, r, g, b) {
		if(strColor.indexOf("(") < 0 && strColor.indexOf(")") < 0) 
			return strColor;
		
		let rgb = strColor.split("(")[1].split(")")[0].split(',');
		if(rgb.length < 3)
			return strColor;
		
		r += parseInt(rgb[0]);
		g += parseInt(rgb[1]);
		b += parseInt(rgb[2]);
		
		return "rgb("+r+","+g+","+b+")";
	}


	/* Events */
	$(window).resize(function() {
		draw();
	});
});