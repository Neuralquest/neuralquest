define(['dojo/_base/declare', 'dojo/_base/array',  "dojo/_base/lang", "dojo/dom-style",'dijit/form/Select', 'dijit/Toolbar', 'dijit/form/DateTextBox', "dojo/promise/all", 
         'dijit/Editor', 'dojo/store/Memory', 'dojo/dom-construct', "dojo/on", "dojo/cookie", "dojo/hash", "dijit/form/ToggleButton",
         "nq/nqWidgetBase", 'dijit/layout/ContentPane', "dojo/dom-geometry", "dojo/sniff", "dojo/date/locale", "dojo/html",
        'dgrid/OnDemandGrid', 'dgrid/editor', 'dgrid/Selection', 'dgrid/Keyboard', 'dgrid/extensions/DijitRegistry', "dgrid/extensions/DnD",
        "dgrid/Selection", "dgrid/selector", "dgrid/selector", "dijit/form/Button","dojo/_base/array", "dijit/registry",
        "dojo/date/stamp", "dojo/when", 'dojo/promise/instrumentation', 
        
        'dijit/_editor/plugins/TextColor', 'dijit/_editor/plugins/LinkDialog', 'dijit/_editor/plugins/ViewSource', 'dojox/editor/plugins/TablePlugins', 
        /*'dojox/editor/plugins/ResizeTableColumn'*/],
	function(declare, arrayUtil, lang, domStyle, Select, Toolbar, DateTextBox, all, 
			Editor, Memory, domConstruct, on, cookie, hash, ToggleButton,
			nqWidgetBase, ContentPane, domGeometry, has, locale, html, 
			Grid, editor, Selection, Keyboard, DijitRegistry, Dnd,
			Selection, selector, Button, array, registry,
			stamp, when, instrumentation){
   
	return declare("nqGridWidget", [nqWidgetBase], {
		postCreate: function(){
			this.inherited(arguments);

			var PERMITTEDVAULE_CLASS_ID = '58';
			var RTF_CLASS_ID = '65';
			var DATE_CLASS_ID = '52';
			var STRING_CLASS_ID = '54';
			var INTEGER_CLASS_ID = '55';
			var NUMBER_CLASS_ID = '56';
			var BOOLEAN_CLASS_ID = '57';
			

			//initially show the toolbar div
			domStyle.set(this.pageToolbarDivNode, 'display' , '');
			// Create toolbar and place it at the top of the page
			this.normalToolbar = new Toolbar({});
			var self = this;
			// Add sibling toggle button
			var siblingButton = new ToggleButton({
		        showLabel: true,
		        label: 'Add Row',
				iconClass: 'addIcon',
		        onClick: function(evt){
		        	var viewDefToCreate = self.viewsArr[0];//TODO what about more than one 
					var classToCreate = viewDefToCreate.mapsToClasses[0];
					var viewId = self.viewsArr[0].id;
//					console.log(classToCreate.className);
					//add the child
					var addObj = {
						'id': '',//cid will be added by our restStore exstension, we need a dummy id
						'viewId': viewId, 
						'classId': classToCreate.id
					};
					//TODO add default values
					//addObj[self.viewDef.label] = '[new '+classToCreate.className+']';
					var newItem = self.store.add(addObj);
					//update the parent
					var parentItem = self.store.get(self.query.parentId);
					if(!parentItem[viewId]) parentItem[viewId] = [];
					parentItem[viewId].unshift(newItem.id);
					self.store.put(parentItem);
					self.grid.refresh();
					self.grid.select(newItem);
		        },
				style : {'margin-left':'5px'} 
			});
			this.normalToolbar.addChild(siblingButton);
			// Add delete toggle button
			this.deleteButton = new ToggleButton({
		        showLabel: true,
		        checked: false,
		        label: 'Delete Row',
				iconClass: 'removeIcon',
				style : {'margin-left':'5px'} 
			});
			this.normalToolbar.addChild(this.deleteButton);
			this.pageToolbarDivNode.appendChild(this.normalToolbar.domNode);
	
			var PAGE_MODEL_VIEW_ID = 1802;
			var VIEWS_VIEW_ID = 538;
			var CLASS_MODEL_VIEW_ID = 844;
			var MANYTOMANY_ASSOC = 10;	//TO MANY
			var OBJECT_TYPE = 1;
			//something wierd just happend. I have to add dojo. to when, else it dont work: object is not a function
			//dojo.when(_nqDataStore.getChildren(this.widgetObj, [VIEWS_VIEW_ID]), function(viewObjArr){
			//recursivily get all of the views that belong to this widget
			dojo.when(self.store.getManyByAssocType(CLASS_MODEL_VIEW_ID+'/'+this.widgetObj.id.split('/')[1], MANYTOMANY_ASSOC, OBJECT_TYPE, true), function(viewItemArr){
				var attrRefPropertiesPromisses = [];
				for(var i=0;i<viewItemArr.length;i++){
					var viewItem = viewItemArr[i];
					attrRefPropertiesPromisses.push(dojo.when(self.store.get(PAGE_MODEL_VIEW_ID+'/'+viewItem.id.split('/')[1]), function(viewObj){
						return dojo.when(self.getAttrRefProperties(viewObj), function(propertiesArr){
							for(var j=0;j<propertiesArr.length;j++){
								property = propertiesArr[j];
									
								switch(property.attrClassType){
								case PERMITTEDVAULE_CLASS_ID: 
									property.renderCell = function(object, value, node, options){
										var selectedOptionArr = selectStore.query({id: value});
										if(selectedOptionArr.length>0) node.appendChild(document.createTextNode(selectedOptionArr[0].name));
										else node.appendChild(document.createTextNode('id: '+value));
									};
									var selectStore = new Memory({data: property.permittedValues});
									property.editorArgs = {
											'store': selectStore, 
											'style': "width:99%;",
											'labelAttr': 'name',
											'maxHeight': -1, // tells _HasDropDown to fit menu within viewport
											'fetchProperties': { sort : [ { attribute : "name" }]},
											'queryOptions': { ignoreCase: true }//doesnt work
											//value: 749
									};
									property.editor = Select;
									break;	
								case RTF_CLASS_ID: 
									var toolbar = new Toolbar({
										//'style': {'display': 'none'}
									});
									self.editorToolbarDivNode.appendChild(toolbar.domNode);
									property.editorArgs = {
											'toolbar': toolbar, 
											'addStyleSheet': 'css/editor.css',
											'extraPlugins': self.extraPlugins,
											'maxHeight': -1
									};					
									property.editor = Editor;
									property.renderCell = function(object, value, node, options) {
										html.set(node, value);
									}
									break;	
								case DATE_CLASS_ID:
									property.renderCell = function(object, value, node, options) {
										console.log('value', value);
										if(!value || value=='') return;
										var date = null;
										if(lang.isObject(value)) date = value;//the date widget returns an date object
										else date = dojo.date.stamp.fromISOString(value);
										html.set(node, date.toLocaleDateString());
									};
									property.set = function(item) {
										var value = item[prop.name];
										if(!value) return;
										return value.toISOString();
									};
									property.autoSave = true;
									property.editor = DateTextBox;
									break;	
								case STRING_CLASS_ID:
									property.editor = 'text';
									break;	
								case INTEGER_CLASS_ID: 
									property.editor = 'number';
									break;	
								case NUMBER_CLASS_ID: 
									property.editor = 'number';
									break;	
								case BOOLEAN_CLASS_ID: 
									property.editor = 'checkbox';
									break;	
								};
							}
//					console.log('propertiesArr', propertiesArr);
							self.grid = new (declare([Grid, Selection, Keyboard, DijitRegistry, Dnd]))({
								//'id' : 'widget'+state.tabId,
								'class': '.nqGrid',
								'store': self.store,
								'selectionMode': "single",
								'loadingMessage': 'Loading data...',
								'noDataMessage': 'No data.',
								'query': {parentId: self.selectedObjIdPreviousLevel, joinViewAttributes: self.viewIdsArr},
								'columns': propertiesArr,
								'cleanAddedRules': true,
								'className': "dgrid-autoheight"// version dgrid 0.3.14
							}, domConstruct.create('div'));
//							for(var key in gridStyle){
//								this.grid.styleColumn(key, gridStyle[key]);
//							}
							self.pane.containerNode.appendChild(self.grid.domNode);

							self.grid.on("dgrid-error", function(event) {
								//nq.errorDialog;
								// Display an error message above the grid when an error occurs.
				    	    	new dijit.Dialog({title: "Get Error", extractContent: true, content: event.error.message}).show();
							});
											
							self.grid.on(".dgrid-row:click", function(event){
								var item = self.grid.row(event).data;
								if(self.deleteButton.get('checked')){
									self.deleteButton.set('checked', false);
									self.store.remove(item.id);
									
									var viewId = self.viewsArr[0].id;
									var parentItem = self.store.get(self.query.parentId);
									var pos = parentItem[viewId].indexOf(item.id);
									parentItem[viewId].splice(pos, 1);
									_nqDataStore.put(parentItem);
									self.grid.refresh();
								}
								else{
									var item = self.grid.row(event).data;
									//var level = self.level;
									nq.setHashViewId(self.level, item.viewId, self.tabId, item.id.split('/')[1]);	
								}
							});
							/*self.grid.on("dgrid-refresh-complete", function(event){
//								var row = grid.row(event);
								console.log("Row complete:", event);
							});
							*/
							self.grid.startup();

						}, nq.errorDialog);				
						self.createDeferred.resolve(self);//ready to be loaded with data					
					}));
				}
				return all(attrRefPropertiesPromisses);
			});
		},
		setSelectedObjIdPreviousLevel: function(value){
			//load the data
			if(this.selectedObjIdPreviousLevel == value) return this;
			this.selectedObjIdPreviousLevel = value;
			
			//does this return a promise?
			this.grid.set('query',{parentId: value, joinViewAttributes: this.viewIdsArr});
			var promise = this.grid.refresh();
			
			return this;//TODO
			return this.setSelectedObjIdPreviousLevelDeferred.promise;
			this.setSelectedObjIdPreviousLevelDeferred.resolve(this);
		}
	});
});