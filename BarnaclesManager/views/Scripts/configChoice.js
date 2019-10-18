$(function() {
	// Dom
	var sections = $('.configForms');
	var links = $('.configbar li');
	
	// Click sur un lien
	$("a[href*='#']:not([href='#'])").click(function(event) {
		var memePage = false;
		
		if(location.hostname == this.hostname) { 
			if(this.pathname.replace(/^\//,"") == location.pathname.replace(/^\//,"")) { 
				memePage = true;
			}
		}
		
		// Pas la meme page -> pas de scrolling
		if(!memePage)
			return;
		
		// Recupere: #Anchor
		var anchor = $(this.hash);
		anchor = anchor.length ? anchor : $("[name=" + this.hash.slice(1) +"]");
        if (anchor.length) {
			activeSection(anchor);
			event.preventDefault();
		}
	});
	
	function activeSection(section) {
		sections.css('display', "none");
		section.css('display', "block");
		
		links.toggleClass('selected');	
	}
	
});