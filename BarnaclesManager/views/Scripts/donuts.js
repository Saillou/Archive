$(function() {	
	/* -- Functions -- */
	function adaptSize() {
		cnvDonutSys.width  = cnvDonutSys.offsetWidth;
		cnvDonutSys.height = cnvDonutSys.width*0.75;		
		
		cnvDonutSd.width  = cnvDonutSd.offsetWidth;
		cnvDonutSd.height = cnvDonutSd.width*0.75;
	}
	function clear() {
		SYS_DRAWN = [];
		SD_DRAWN = [];
		
		ctxDonutSys.clearRect(0, 0, cnvDonutSys.width, cnvDonutSys.height);
		ctxDonutSd.clearRect(0, 0, cnvDonutSd.width, cnvDonutSd.height);
	}
	function fromData(elements, parse = false) {
		var tab = [];
		for(el of elements)
			tab.push({'label':el.name,'value': parse ? parseFloat(el.value) : el.value});
		return tab;
	}
	function isEmptyOrNull(data) {
		if(data.length > 0) {
			for(let i = 0; i < data.length; i++)
				if(data[i].value > 0)
					return false;
		}
		return true;
	}
	
	/* -- Get style -- */
	var style, colorBg, colorR, colorG, colorB;
	for(let styleSheet = document.styleSheets[i=0]; styleSheet; styleSheet = document.styleSheets[i++]) {
		if(styleSheet.ownerNode.attributes.href.nodeValue != "Design/styleMain.css") 
			continue;
			
		for(let rule = styleSheet.cssRules[j=0]; rule; rule = styleSheet.cssRules[j++]) {
			if(rule.selectorText != ":root") 
				break;
			
			style = rule.style;
			
			colorBg = style.getPropertyValue('--main-bg-color').trim();
			colorR = style.getPropertyValue('--red-color').trim();
			colorB = style.getPropertyValue('--blue-color').trim();
			colorG = style.getPropertyValue('--green-color').trim();
		}
		
		break;
	}
	function draw() {
		adaptSize();
		clear();
		
		drawDonut(cnvDonutSys, ctxDonutSys, SYS_CARD_USAGE, SYS_DRAWN);
		
		// Can be null
		if(!isEmptyOrNull(SD_CARD_USAGE))
			drawDonut(cnvDonutSd, ctxDonutSd, SD_CARD_USAGE, SD_DRAWN);
		else
			drawNullDonut(cnvDonutSd, ctxDonutSd, SD_CARD_USAGE, SD_DRAWN);
	}
	
	const COLOR_BG 	= (colorBg && colorBg.length > 0) ? colorBg : "rgb(37,40,48)";
	const COLOR_R 	= (colorR && colorR.length   > 0) ? colorR  : "rgb(142,27,60)";
	const COLOR_G 	= (colorG && colorG.length   > 0) ? colorG  : "rgb(65,99,47)";
	const COLOR_B 	= (colorB && colorB.length   > 0) ? colorB  : "rgb(12,73,97)";
	const COLOR_GRAY = "rgb(62,62,70)";
	const COLORS 	= [COLOR_R, COLOR_G, COLOR_B];
	
	/* Doms */
	var cnvDonutSys = document.getElementById('__sysUse').getElementsByTagName('canvas')[0];
	var cnvDonutSd	= document.getElementById('__sdUse').getElementsByTagName('canvas')[0];
	
	var domDataSys 	= document.getElementById('__SYS_USE').getElementsByTagName('input');
	var domDataSd 	= document.getElementById('__SD_USE').getElementsByTagName('input');
	
	var ctxDonutSys = cnvDonutSys.getContext("2d");
	var ctxDonutSd	= cnvDonutSd.getContext("2d");
	
	/* Datas */
	var SYS_CARD_USAGE 	= fromData(domDataSys, true);
	var SD_CARD_USAGE 	= fromData(domDataSd, true);
	
	var SYS_DRAWN 		= [];
	var SD_DRAWN 		= [];
	
	/* Start */
	draw();

	/* Drawing */
	function drawInfos(event, cnvDonut, ctxDonut, data, reDraw = true) {	
		var objDocument = $(document);
		var objDonut 	= $(cnvDonut);
		
		var mouse 		= {'x':event.clientX + objDocument.scrollLeft(), 'y':event.clientY + objDocument.scrollTop()};
		var poppup 		= {'exist':false, 'context':null, 'posX':null, 'posY':null, 'content':null};
			
		// Intersections activities
		for(let sd of data) {
			if(poppup.exist)
				break;
			
			let x = sd.Param.x + objDonut.offset().left;
			let y = sd.Param.y + objDonut.offset().top;
			
			let dx = mouse.x - x;
			let dy = mouse.y - y;
			let r = Math.sqrt(dx*dx + dy*dy);
			let theta = Math.atan2(dy, dx);
			
			// Modulo 2PI (and prevent value <0)
			while(theta < 0) 
				theta += 2*Math.PI;
			theta %= 2*Math.PI;
			
			if(theta > sd.Param.beg && theta <= sd.Param.end) {
				if(r > sd.Param.ir && r <= sd.Param.or) {
					poppup.exist = true;
					poppup.context = ctxDonut;
					poppup.posX = mouse.x - objDonut.offset().left;
					poppup.posY = mouse.y - objDonut.offset().top - 15;
					poppup.content = sd.Data.label;
				}
			}
		}
		
		poppupHere = poppup.exist;
		
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

	function drawArcCercle(ctx, x, y, r, beg, end, color) {
		var middle = {
			'x':x,
			'y':y
		};
		var begPoint = {
			'x':r*Math.cos(beg)+x,
			'y':r*Math.sin(beg)+y
		};
		
		ctx.beginPath();
		ctx.arc(middle.x, middle.y, r, beg, end);
		ctx.lineTo(middle.x, middle.y);
		ctx.lineTo(begPoint.x, begPoint.y);
		ctx.fillStyle = color;
		ctx.fill();
		ctx.closePath();
	}
	
	function drawNullDonut(cnvDonut, ctxDonut, data, dataRes) {
		const WIDTH = cnvDonut.width;
		const HEIGHT = cnvDonut.height;
		
		const OUTER_R = 0.7*Math.min(WIDTH,HEIGHT)/2;
		const INNER_R = 0.6*OUTER_R;
		
		const x = WIDTH/2;
		const y = HEIGHT/2;	
		
		// Out
		drawArcCercle(ctxDonut, x, y, OUTER_R, 0, 2*Math.PI, COLOR_GRAY);
		
		// Inner
		drawArcCercle(ctxDonut, x, y, INNER_R, 0, 2*Math.PI, COLOR_BG);
		
		// Info
		dataRes.push({
			'Shape'	: 'donut', 
			'Param'	: {'x':x, 'y':y, 'or':OUTER_R, 'ir':INNER_R, 'beg':0, 'end':2*Math.PI}, 
			'Data'	: {'label':'Not detected', 	'value': -1}
		});
			
		// Legend
		var legendData = [];
		legendData.push({'label':'Not detected', 'color':COLOR_GRAY});
		drawLegend(ctxDonut, legendData, {'x':0, 'y':0, 'width':140, 'height':100});
	}
	function drawDonut(cnvDonut, ctxDonut, data, dataRes) {
		if(data.length < 3)
			return;
		
		const WIDTH = cnvDonut.width;
		const HEIGHT = cnvDonut.height;
		
		const OUTER_R = 0.7*Math.min(WIDTH,HEIGHT)/2;
		const INNER_R = 0.6*OUTER_R;
		
		const x = WIDTH/2;
		const y = HEIGHT/2;
		
		var beg = 0;
		var end = 0;
		
		var legendData = [];
		
		// Outer
		for(let i = 0; i < 3; i++) {
			beg = end;
			end = beg + 2*Math.PI * data[i].value;
			drawArcCercle(ctxDonut, x, y, OUTER_R, beg, end, COLORS[i]);
			if(data[i].value >= 0.03) {
				let r2 = (OUTER_R + INNER_R)/2;
				let t2 = (beg + end + 0.03)/2;
				xText = r2 * Math.cos(t2) + x;
				yText = r2 * Math.sin(t2) + y;
				ctxDonut.font="15px Arial";
				ctxDonut.fillStyle = 'rgb(142,142,145)';
				ctxDonut.fillText(data[i].value * 100 + "%", xText, yText);
			}
			
			dataRes.push({
				'Shape'	: 'donut', 
				'Param'	: {'x':x, 'y':y, 'or':OUTER_R, 'ir':INNER_R, 'beg':beg, 'end':end}, 
				'Data'	: data[i]		
			});
			
			legendData.push({'label':data[i].label, 'color':COLORS[i]});
		}
		
		// Inner
		drawArcCercle(ctxDonut, x, y, INNER_R, 0, 2*Math.PI, COLOR_BG);
		
		drawLegend(ctxDonut, legendData, {'x':0, 'y':0, 'width':140, 'height':100});
	}
	
	/* Events */
	$(cnvDonutSys).mousemove(function(event) {
		drawInfos(event.originalEvent, cnvDonutSys, ctxDonutSys, SYS_DRAWN);
	});
	$(cnvDonutSd).mousemove(function(event) {
		drawInfos(event.originalEvent, cnvDonutSd, ctxDonutSd, SD_DRAWN);
	});
	
	
	cnvDonutSys.addEventListener("mouseout", draw);
	cnvDonutSd.addEventListener("mouseout", draw);
	
	$(window).resize(function() {
		draw();
	});
});