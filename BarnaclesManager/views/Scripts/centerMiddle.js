$(function() {
	/* DOM */
	var divParent 	= document.body;
	var divToCenter = document.getElementById('ContainerWrapper');

	/* Start */
	center();

	/* Events */
	$(window).resize(function() {
		center();
	});

	/* Functions */
	function center() {
		var hp = divParent.offsetHeight;
		var hc = divToCenter.offsetHeight;

		var margin = (hp-hc)/2;
		if(margin < 0) margin = 0;
		
		divToCenter.style.top = margin + 'px';
	}
});