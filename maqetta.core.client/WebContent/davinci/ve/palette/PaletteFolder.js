define([
	"dojo/_base/declare",
	"dijit/_WidgetBase",
	"dojo/dom-class",
	"dojo/fx",
	"davinci/Runtime",
	"davinci/ve/metadata"
], function(declare, _WidgetBase, domClass, fx, Runtime, Metadata){

return declare("davinci.ve.palette.PaletteFolder", _WidgetBase, {

	icon: "",
	displayName: "",
	paletteId: "",
	palette: null,
	// pointer to preset to which this PaletteFolder belongs
	preset: null,
	// id of preset for which this PaletteFolder object will be included
	presetId: null,
	presetClassName: null,	// Only used for debugging purposes
	_type: '',		// 'simple' = just has PaletteItem children, or 
					// 'subsection_container' = has PaletteFolder subsections inside, or
					// 'subsection' = is a Palette folder that represents a subsection
	_isOpen: false,		// Indicates whether children PaletteItems for this folder are showing
	_openSubsection: null,	// For PaletteFolders that have subsections, currently open subsection
							// PaletteItems within _openSubsection only show is its subsection container is open

	buildRendering: function(){
		this.palette = dijit.byId(this.paletteId);
		var div = this.domNode = this.palette.folderTemplate.cloneNode(true);
		if(this.presetClassName){	// Only used for debugging purposes
			domClass.add(div, this.presetClassName);
		}
		var a = div.firstChild;
		dojo.attr(a, "tabIndex", "0");
		a.onclick = this.palette.nop; // to avoid firing the onbeforeunload event (dojo.event.connect doesn't work for this purpose)
		var img = a.firstChild;
		img.src = this.icon;
		a.appendChild(dojo.doc.createTextNode(this.displayName));
//		dojo.setSelectable(this.domNode, false);
		div._paletteFolder = this;
		this._type = (this.subsections ? 'subsection_container' : (this.subsection ? 'subsection' : 'simple'));
		if(this._type == 'subsection'){
			domClass.add(div, 'PaletteFolderSubsection');
		}
	},

	postCreate: function(){
		this.connect(this.domNode, "onmouseover", "folderMouseOverHandler");
		this.connect(this.domNode, "onmouseout", "folderMouseOutHandler");
		this.connect(this.domNode, "onclick", "folderClickHandler");
	},
	
	startup: function(){
	},
	
	isFocusable: function(){
		return true;
	},
	
	focus: function(){
		dijit.focus(this.domNode);
	},

	addChild: function(node){
		var children = this.palette.getChildren();
		for(var i = 0, len = children.length; i < len; i++){
			var child = children[i];
			if(child != this){
				continue;
			}
			this.palette.addChild(node,i+1);
			
			return true;
		}
		return false;
	
	},
	
	/**
	 * Find the currently selected PaletteItem object with the palette item group
	 * within which the given paletteItem belongs.
	 * @param children {array} Array of children for current palette (mostly PaletteFolder and PaletteItem)
	 * @param startIndex {number} Index into children for first child within palette item group
	 * @returns { endIndex:{number}, selectedIndex:{number} } 
	 */
	_paletteItemGroupInfo: function(children, startIndex){
		var obj = {};
		var idx = startIndex;
		var child = children[idx];
		var paletteItemGroup = child._paletteItemGroup;
		do{
			//FIXME: temporarily pick the first one
			if(idx == startIndex){
				obj.selectedIndex = idx;
			}
			idx++;
			if(idx >= children.length){
				break;
			}
			child = children[idx];
		}while(child.declaredClass == "davinci.ve.palette.PaletteItem" && child._paletteItemGroup === paletteItemGroup);
		obj.endIndex = idx - 1;
		return obj;
	},
	
	folderClickHandler: function(evt){
		
		// Determine which preset applies to the current editor
		if(!Runtime.currentEditor || Runtime.currentEditor.declaredClass != "davinci.ve.PageEditor" ||
				!Runtime.currentEditor.getContext){
			return;
		}
		
		var children = this.palette.getChildren();
		for(var i = 0, len = children.length; i < len; ){
			var child_i = children[i];
			// If we have reached the current PaletteFolder...
			if(child_i == this){
				// See if this PaletteFolder has subsections
				// If so, toggle the visibility of the subsections
				// and hide any PaletteItems in the subsections
				if(this._type == 'subsection_container'){	// Only PaletteFolder's with child sections have this property
					// Loop through subsequent children and process all PaletteItems
					// until reaching the next PaletteFolder that isn't a subsection (or end of list)
					this._isOpen = !this._isOpen;
					for(var j = i + 1; j < len; j++){
						var child_j = children[j];
						if(child_j.declaredClass == "davinci.ve.palette.PaletteFolder"){
							if(child_j._type != 'subsection'){	// PaletteFolder's that are subsections have this property
								// Reached next major section PaletteFolder
								break;
							}
							// Toggle visibility of subsections for this section
							if(this._isOpen){
								fx.wipeIn({node: child_j.id, duration: 200}).play();
								// Flag whether this subsection is open
								// Subsequent looping with display/hide the PaletteItems for this subsection
								child_j._isOpen = (child_j == child_j.subsection_container._openSubsection);
							}else{
								fx.wipeOut({node: child_j.id, duration: 200}).play();
								child_j.isOpen = false;
							}
						}else{ // child.declaredClass == "davinci.ve.palette.PaletteItem"
							if(this._isOpen && child_j.PaletteFolderSubsection._isOpen){
								// Show the PaletteItems for the currently open subsession
								fx.wipeIn({node: child_j.id, duration: 200}).play();
							}else{
								child_j.domNode.style.display = 'none';
							}
						}
					}
					i = j;
				}else{
					this._isOpen = !this._isOpen;
					if(this._type == 'subsection'){	
						this.subsection_container._openSubsection = this._isOpen ? this : null;
					}
					
					// Loop through subsequent children and process all PaletteItems
					// until reaching the next PaletteFolder (or end of list)
					for(var j = i + 1; j < len; ){
						var child_j = children[j];
						if(child_j.declaredClass != "davinci.ve.palette.PaletteItem"){
							// Reached next PaletteFolder
							break;
						}
						var obj = this._paletteItemGroupInfo(children, j);
						for(var k=j; k <= obj.endIndex; k++){
							var child_k = children[k];
							// Decide whether the given PaletteItem should be visible
							// given the current preset ('mobile', 'desktop', 'sketchhifi', or 'sketchlofi')
							var descriptor = Metadata.getWidgetDescriptorForType(child_k.type);
							var collectionId = descriptor && descriptor.collection;
							var show = false;
							if(child_k.preset && child_k.preset.collections){
								var collections = child_k.preset.collections;
								for(var co=0; co < collections.length; co++){
									var collection = collections[co];
									if(collection.id && collection.id === collectionId){
										show = collection.show;
										break;
									}
								}
							}
							if(k == obj.selectedIndex && show){
								// Toggle visibility depending on whether the PaletteFolder
								// is open or closed
								if(this._isOpen){
									fx.wipeIn({node: child_k.id, duration: 200}).play();
								}else{
									fx.wipeOut({node: child_k.id, duration: 200}).play();
								}
							}else{
								child_k.domNode.style.display = "none";
							}
						}
						j = k;
					}
					i = j;
				}
			}else{
				// Hide any visible PaletteItems outside of the current PaletteFolder
				if(child_i.declaredClass == "davinci.ve.palette.PaletteItem" && 
						child_i.domNode.style.display != "none"){
					fx.wipeOut({node: child_i.id, duration: 200}).play();
				}
				// Hide any PaletteFolders that are visible and that are subsections of PaletteFolder's that are closed
				if(child_i.declaredClass == "davinci.ve.palette.PaletteFolder"){
					if(child_i._type == 'subsection' && child_i._isOpen && !child_i.subsection_container._isOpen){
						fx.wipeOut({node: child_i.id, duration: 200}).play();
						child_i._isOpen = false;
					}else{
						if(child_i != this.subsection_container){
							child_i._isOpen = false;
						}
					}
				}
				i++;
			}
		}
		return false;
	},

	folderMouseOverHandler: function(evt){
		dojo.removeClass(this.domNode, "dojoyPaletteFolderLow");
		dojo.addClass(this.domNode, "dojoyPaletteFolderHi");
	},

	folderMouseOutHandler: function(evt){
		dojo.removeClass(this.domNode, "dojoyPaletteFolderHi");
		dojo.addClass(this.domNode, "dojoyPaletteFolderLow");
	}
	
});
});