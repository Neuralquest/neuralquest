require([
'dojo/_base/array', 'dojo/dom-style', 'dojo/_base/fx', 'dojo/ready', 'dojo/topic', "dojo/on", 'dojo/hash', 'dijit/registry', 
'dojo/dom', 'dojo', 'dojo/_base/lang', 'dojo/_base/declare','dojo/_base/array', 'dojo/dom-construct', 
'dojo/_base/declare', 'dojo/store/Observable', 'dojo/store/Cache', 'dojo/store/JsonRest', 'dojo/store/Memory',
'dojo/Deferred', 'dojo/when', 'dojo/query', 'dijit/layout/BorderContainer', 
'dijit/layout/TabContainer', 'dijit/layout/ContentPane', 'dijit/layout/AccordionContainer', "dojo/cookie", 
'nq/nqProcessChart', 'nq/nqClassChart', 'nq/nqForm', 'nq/nqTable', 'nq/nqJsonRest', 'nq/nqTree', 'nq/nqObjectStoreModel', 'nq/nqDocument', 'nq/nqCache',
'dojo/promise/instrumentation', 'dojox/html/styles', 'dojo/query!css2'], 
function(arrayUtil, domStyle, fx, ready, topic, on, hash, registry,
		dom, dojo, lang, declare, array, domConstruct,
		declare, Observable, Cache, JsonRest, Memory, 
		Deferred, when, query, BorderContainer, 
		TabContainer, ContentPane, AccordionContainer, cookie, 
		nqProcessChart, nqClassChart, nqForm, nqTable, nqJsonRest, nqTree, nqObjectStoreModel, nqDocument, nqCache,
		instrumentation, styles) {
	
	_nqMemoryStore = Observable(new Memory({}));
	_nqDataStore = new nqCache(new nqJsonRest({target:"data/"}), _nqMemoryStore);
	var _transaction = _nqDataStore.transaction();
	_nqSchemaMemoryStore = new Memory();
	_nqSchemaStore = Cache(new JsonRest({target:"schema/"}), _nqSchemaMemoryStore);
	/*
*/
	//////////////////////////////////////////////////////////////////////////////
	// Initialize
	//////////////////////////////////////////////////////////////////////////////
	ready( function() {
		fx.fadeOut({node: 'loadingOverlay',	onEnd: function(node){domStyle.set(node, 'display', 'none');}}).play();
		topic.subscribe("/dojo/hashchange", interpritHash);
		on(registry.byId('cancelButtonId'), 'click', function(event){_transaction.abort();});
		on(registry.byId('saveButtonId'), 'click', function(event){_transaction.commit();});
		on(registry.byId('helpButtonId'), 'change', function(value){
			if(value) dojox.html.insertCssRule('.helpTextInvisable', 'display:block;', 'nq.css');
			else dojox.html.removeCssRule('.helpTextInvisable', 'display:block;', 'nq.css');
		});

/*		when(_nqDataStore.getManyByAssocType('844/846', 10, 1, true), function(viewObjArr){
			var ASSOCS_ATTR_ID = 1613;
			var MAPSTO_ASSOC = 5;			//TO ONE
			var SUBCLASSES_PASSOC = 15;		//TO MANY
			var CLASS_TYPE = 0;
			console.log('getManyByAssocType', viewObjArr);					
			//get the class that this view maps to
			for(var i=0;i<viewObjArr.length;i++){
				viewObj = viewObjArr[i];
				var destClassId = viewObj[ASSOCS_ATTR_ID][MAPSTO_ASSOC][0];
				//get the subclasses as seen from the destClass
				when(_nqDataStore.getManyByAssocType(destClassId, SUBCLASSES_PASSOC, CLASS_TYPE, true), function(subClassArr){
					for(var j=0;j<subClassArr.length;j++){
						var subClass = subClassArr[j];
						console.log(subClass);
					}
				}, errorDialog);
			}
		}, errorDialog);*/
//		when(_nqDataStore.getManyByParentWidgetOrView('844/824','844/2387'), function(results){
//			console.log('getManyByParentWidgetOrView',results);					
//		}, errorDialog);

		//Load the schema in its entirety 
		var viewId = getState(0).viewId;
		if(!viewId) viewId = 842;
		var query = _nqSchemaStore.query({viewId: viewId});
		when(query, function(objects){
//			fx.fadeOut({node: 'loadingOverlay',	onEnd: function(node){domStyle.set(node, 'display', 'none');}}).play();
			if(hash() == "") {
				var neuralquestState = cookie('neuralquestState');
				if(neuralquestState) hash(neuralquestState, true);
				else hash("842.1784.824.846.1866", true);
			}
			else interpritHash();
		});
	});
	//////////////////////////////////////////////////////////////////////////////
	// Interprit the Hash Change
	//////////////////////////////////////////////////////////////////////////////
	function interpritHash(hash, lvl){
		var level = lvl?lvl:0;
		var state = getState(level);
		if(!state.viewId) return true;
		var PAGE_MODEL_VIEWS_ID = 538;
		var ACCORTAB_ATTR_ID = 2149;
		var ACCORDION_ID = 1777;
		var WIDGETS_VIEW_ID = 2378;
		var parentViewPane = null;
		//find the parent pane to display in
		if(!state.viewIdPreviousLevel) parentViewPane = registry.byId('placeholder');//no previous level. use placeholder defined in index.html
		else parentViewPane = registry.byId('slave'+state.viewIdPreviousLevel);//use the slave from the previous level
		//get the view for this level
		return when(_nqDataStore.get(PAGE_MODEL_VIEWS_ID+'/'+state.viewId), function(viewObj){
			//are we createing an accordion container in a border container or a tab container?
			var viewPanePaneCreated = null;
			if(viewObj[ACCORTAB_ATTR_ID]==ACCORDION_ID) viewPanePaneCreated = createAccordionInBorderContainer(parentViewPane, viewObj, state.tabId, level);
			else viewPanePaneCreated = createTabs(parentViewPane, viewObj, state.tabId, level);
			return when((viewPanePaneCreated), function(selectedTabObj){//returns the selected tab!
				//when the viewpane is created, fill the selected tab
				parentViewPane.resize();//this is a must
				//start the creation of the widgets as a separate thread
				when(_nqDataStore.getChildren(selectedTabObj, [WIDGETS_VIEW_ID]), function(widgets){
					//when we've got all the child widgets that belong to this tab, create them
					for(var i=0;i<widgets.length;i++){
						var widgetObj = widgets[i];
						when(createNqWidget(widgetObj, selectedTabObj, viewObj, level), function(widget){
							//when the widget is created tell it which object was selected on the previous level
							//widget types will responde diferently: fill the form, set the query for the table, recreate the tree, fly to the object in 3D, etc.
							when(widget.setSelectedObjIdPreviousLevel(state.selectedObjectIdPreviousLevel), function(wid){
								wid.setSelectedObjIdThisLevel(state.selectedObjId);
							}, errorDialog);
						}, errorDialog);
					}
					return widgets;
				}, errorDialog);
				//We do not have to wait for the widgets to be completed. Instead we can continue with a recurssive call to interpritHash
				return when(interpritHash(hash, level+1), function(result){
					return result;
				});
			});
		}, errorDialog);
	}	
	//////////////////////////////////////////////////////////////////////////////
	// Add an accordion container in a border container
	//////////////////////////////////////////////////////////////////////////////
	function createAccordionInBorderContainer(parentContentPane, viewObj, selectedTabId, level){
		var ACCORTAB_VIEW_ID = 1802;
		return when(_nqDataStore.getChildren(viewObj, [ACCORTAB_VIEW_ID]), function(tabs){
			var selectedTabObj = tabs[0];
			// if the border container already exists we can simply return the tabs
			if(registry.byId('borderContainer'+viewObj.id.split('/')[1])) {
				for(var i=0;i<tabs.length;i++){
					var tt = tabs[i];
					var ttId = tt.id.split('/')[1];
					if(ttId == selectedTabId) selectedTabObj=tt; 
				}
				return selectedTabObj;
			}
			// We're filling a slave, clean it first. It may have been used by another view before
			arrayUtil.forEach(parentContentPane.getChildren(), function(childWidget){
				if(childWidget.destroyRecursive) childWidget.destroyRecursive();
			});
					
			var design = 'sidebar';//obtain horizontal, vertical, none from viewDef?
			var borderContainer = new BorderContainer( {
				'id' : 'borderContainer'+viewObj.id.split('/')[1],
				'region' : 'center',
				'design' : design,
				'persist' : true,
				//'class': 'noOverFlow'
				'style' : {width: '100%', height: '100%', overflow: 'hidden', padding: '0px', margin: '0px'}
			});
			var leftPane = new ContentPane( {
				'id' : 'master'+viewObj.id.split('/')[1],
				'region' : 'leading',
				'class' : 'backgroundClass',
				'splitter' : true,
				//'class': 'noOverFlow',
				'style' : {width: '200px',overflow: 'hidden',padding: '0px', margin: '0px'}
			});
			var centerPane = new ContentPane( {
				'id' : 'slave'+viewObj.id.split('/')[1],
				'region' : 'center',
				'class' : 'backgroundClass',
				//'content' : '<p>Loading...</p>',
				//'class': 'noOverFlow'
				'style' : {overflow: 'hidden',padding: '0px', margin: '0px'}
			});
			borderContainer.addChild(leftPane);
			borderContainer.addChild(centerPane);
			parentContentPane.containerNode.appendChild(borderContainer.domNode); //appendChild works better than attaching through create
			//createviewPanePane(leftPane, 0, viewObj.id);
			//createviewPanePane(centerPane, level+1);
		
			var accordianContainer;
			if(tabs.length==1){// this is really only to have palce to store viewPane+viewObj.id. Is there a better way?
				accordianContainer = new ContentPane( {
					'id' : 'viewPane'+viewObj.id.split('/')[1],
					'region' : 'center',
					'style' : {width: '100%',height: '100%',overflow: 'hidden',padding: '0px', margin: '0px'}
				});
			}
			else {
				accordianContainer = new AccordionContainer( {
					'id' : 'viewPane'+viewObj.id.split('/')[1],
					'region' : 'center',
					'duration' : 0,//animation screws out layout. Is there a better solution?
					//'persist' : true,//cookies override our hash tabId
					'class': 'noOverFlow',
					'style' : {width: '100%',height: '100%',overflow: 'hidden',padding: '0px', margin: '0px'}
				});
			}
			leftPane.addChild(accordianContainer);
			var TAB_TITLE_ATTR = 1803;
			for(var i=0;i<tabs.length;i++){
				var tab = tabs[i];
				var tabId = tab.id.split('/')[1];
				if(tabId==selectedTabId) selectedTabObj = tab;//use this one for the return value.
				var tabPane = new ContentPane( {
					'id' : 'tab'+tabId,
//					'viewPane': viewObj.id,
					'title' : tab[TAB_TITLE_ATTR],
					'selected' : tabId==selectedTabId?true:false,
					'class' : 'backgroundClass',
					'style' : {width: '100%',height: '100%',overflow: 'hidden',padding: '0px', margin: '0px'}
				});
				accordianContainer.addChild(tabPane);
				//when we create a tab we can know if we have to create a border container in it. 
				/*
				var childTabsArr = _nqSchemaMemoryStore.query({parentViewId: tab.id, entity: 'tab'});//get the tabs
				if(childTabsArr.length>0){
					if(tab.containerType == 'Accordion') createAccordionInBorderContainer(tabPane, tab.id, selectedTabId, level);
					else createTabs(tabPane, tab.id, selectedTabId, level);
				}*/
				accordianContainer.watch("selectedChildWidget", function(name, oval, nval){
				    //console.log("selected child changed from ", oval.title, " to ", nval.title);
				    var tabId = (nval.id).substring(3);//why is this called so offten? probably cant hurt
				    setHashTabId(level, tabId, viewObj.id.split('/')[1]); // this will trigger createNqWidget
				});
			}
			borderContainer.startup();
			return selectedTabObj;
		}, errorDialog);
	}
	//////////////////////////////////////////////////////////////////////////////
	// Add a tab container
	//////////////////////////////////////////////////////////////////////////////
	function createTabs(parentPane, viewObj, selectedTabId, level){
		var ACCORTAB_VIEW_ID = 1802;
		return when(_nqDataStore.getChildren(viewObj, [ACCORTAB_VIEW_ID]), function(tabs){
			var selectedTabObj = tabs[0];//use this one for the return value.
			// if the ContentPane already exists we can simply return the tabs
			if(registry.byId('viewPane'+viewObj.id.split('/')[1])) {
				for(var i=0;i<tabs.length;i++){
					var tt = tabs[i];
					var ttId = tt.id.split('/')[1];
					if(ttId == selectedTabId) selectedTabObj=tt; 
				}
				return selectedTabObj;
			}
			// We're filling a slave, clean it first. It may have been used by another view before
			arrayUtil.forEach(parentPane.getChildren(), function(childWidget){
				if(childWidget.destroyRecursive) childWidget.destroyRecursive();
			});

			var container;
			if(tabs.length==1){// this is really only to have palce to store viewPane+viewId. Is there a better way?
				container = new ContentPane( {
					'id' : 'viewPane'+viewObj.id.split('/')[1],
					'region' : 'center'
				});
			}
			else {
				container = new TabContainer( {
					'id' : 'viewPane'+viewObj.id.split('/')[1],
					//'persist' : true,//cookies override our hash tabId
					'region' : 'center'
				});
			}
			var TAB_TITLE_ATTR = 1803;
			for(var i=0;i<tabs.length;i++){
				var tab = tabs[i];
				var tabId = tab.id.split('/')[1];
				if(tabId==selectedTabId) selectedTabObj = tab;//use this one for the return value.
				var tabPane = new ContentPane( {
					'id' : 'tab'+tabId,
	//				'viewPane': viewObj.id,
					'title' : tab[TAB_TITLE_ATTR],
					'selected' : tabId==selectedTabId?true:false,
					'class' : 'backgroundClass',
					'style' : {overflow: 'hidden', padding: '0px', margin: '0px', width: '100%', height: '100%'}
				});
				container.addChild(tabPane);
				container.watch("selectedChildWidget", function(name, oval, nval){
				    //console.log("selected child changed from ", oval.title, " to ", nval.title);
				    var tabId = (nval.id).substring(3);//why is this called so offten? probably cant hurt
				    setHashTabId(level, tabId, viewObj.id.split('/')[1]); // this will trigger createNqWidget
				});
				//when we create a tab we can know if we have to create a border container in it. 
				/*
				var childTabsArr = _nqSchemaMemoryStore.query({parentViewId: tab.id, entity: 'tab'});//get the tabs
				if(childTabsArr.length>0){
					if(tab.displayType = 'Sub Accordion'){
						createAccordionInBorderContainer(tabPane, tab.id, selectedTabId, level);
					}
					else createTabs(tabPane, tab.id, selectedTabId, level);
				}*/
			};
			parentPane.addChild(container);
			container.startup();
			if(tabs.length>1) container.resize();
			
			return selectedTabObj;
		}, errorDialog);
	}	
	//////////////////////////////////////////////////////////////////////////////
	// Add the Widget to the Tap Pane and Provide Data For It
	//////////////////////////////////////////////////////////////////////////////
	function createNqWidget(widgetObj, tabObj, viewObj, level){
		var createDeferred = new Deferred();
//console.log('widgetObh', widgetObj);		
		var DISPLAYTYPE_ATTR = 745;
		var ROOT_ATTR = 1804;
		var DOCUMENT_DISPTYPE_ID = 1865;
		var FORM_DISPTYPE_ID = 1821;
		var TABLE_DISPTYPE_ID = 1780;
		var TREE_DISPTYPE_ID = 1779;
		var PROCESS_MODEL_DISPTYPE_ID = 1924;
		var CLASS_MODEL_DISPTYPE_ID = 1782;

		var widgetId = widgetObj.id.split('/')[1];
		var tabId = tabObj.id.split('/')[1];
		var viewId = viewObj.id.split('/')[1];
		
		var state = getState(level);
		var tabNode = dom.byId('tab'+tabId);

		// if the widget already exists we can simply return widgets
		var widget = registry.byId('nqWidget'+widgetId);
		
		if(widget) return widget;

		viewsArr = _nqSchemaMemoryStore.query({parentWidgetId: widgetId, entity: 'view'});//get the views that belong to this wdiget	
		var viewIdsArr = [];
		for(var i=0;i<viewsArr.length;i++){
			viewIdsArr.push(viewsArr[i].id);
		}

		switch(widgetObj[DISPLAYTYPE_ATTR]){
		case DOCUMENT_DISPTYPE_ID:
			widget = new nqDocument({
				id: 'nqWidget'+widgetId,
				store: _nqDataStore,
				createDeferred: createDeferred, //tell us when your done by returning the widget
				tabId: tabId // used by resize
			}, domConstruct.create('div'));
			tabNode.appendChild(widget.domNode);
			break;	
		case FORM_DISPTYPE_ID: 
			widget = new nqForm({
				id: 'nqWidget'+widgetId,
				store: _nqDataStore,
				createDeferred: createDeferred, //tell us when your done by returning the widget
				viewObj: viewObj,
			}, domConstruct.create('div'));
			tabNode.appendChild(widget.domNode);
			break;	
		case TABLE_DISPTYPE_ID:
			widget = new nqTable({
				id: 'nqWidget'+widgetId,
				store: _nqDataStore,
				createDeferred: createDeferred, //tell us when your done by returning the widget
				widgetObj: widgetObj,
				viewIdsArr: viewIdsArr,
				selectedObjIdPreviousLevel: state.selectedObjectIdPreviousLevel,//dgrid needs an initial query
				viewsArr: viewsArr,
				level: level, // used by onClick
				tabId: tabId, // used by onClick
				query: query
			}, domConstruct.create('div'));
			tabNode.appendChild(widget.domNode);
			break;
		case TREE_DISPTYPE_ID:
			widget = new nqTree({
				viewIdsArr: viewIdsArr,
				id: 'nqWidget'+widgetId,
				store: _nqDataStore,
				createDeferred: createDeferred, //tell us when your done by returning the widget
				widgetObj: widgetObj,
				viewObj: viewObj,
				level: level, // used by onClick
				tabId: tabId, // used by onClick
				parentId: widgetObj[ROOT_ATTR]
			}, domConstruct.create('div'));
			tabNode.appendChild(widget.domNode);
			break;	
		case PROCESS_MODEL_DISPTYPE_ID: 
			widget = new nqProcessChart({
				id: 'nqWidget'+widgetId,
				store: _nqDataStore,
				createDeferred: createDeferred, //tell us when your done by returning the widget
				//viewObj: viewObj,
				tabId: tabId, // used by resize
				orgUnitRootId: '850/494', // Process Classes
				orgUnitViewId: '1868',
				orgUnitNameAttrId: '1926',
				stateRootId: '2077/443',
				stateViewId: '2077',
				stateNameAttrId: '2081'
				//skyboxArray: [ 'img/Neuralquest/space_3_right.jpg', 'img/Neuralquest/space_3_left.jpg', 'img/Neuralquest/space_3_top.jpg' ,'img/Neuralquest/space_3_bottom.jpg','img/Neuralquest/space_3_front.jpg','img/Neuralquest/space_3_back.jpg']
			}, domConstruct.create('div'));
			tabNode.appendChild(widget.domNode);
			widget.startup();
			break;
		case CLASS_MODEL_DISPTYPE_ID: 
			widget = new nqClassChart({
				id: 'nqWidget'+widgetId,
				store: _nqDataStore,
				createDeferred: createDeferred, //tell us when your done by returning the widget
				tabId: tabId, // used by resize
				XYAxisRootId: '844/67', // Process Classes
				viewId: viewId,
				nameAttrId: 852,
				ZYAxisRootId: '844/53', //Attributes
				skyboxArray: [ 'img/Neuralquest/space_3_right.jpg', 'img/Neuralquest/space_3_left.jpg', 'img/Neuralquest/space_3_top.jpg' ,'img/Neuralquest/space_3_bottom.jpg','img/Neuralquest/space_3_front.jpg','img/Neuralquest/space_3_back.jpg']
			}, domConstruct.create('div'));
			tabNode.appendChild(widget.domNode);
			widget.startup();
			break;
		};
		return createDeferred.promise;
	}	
	//////////////////////////////////////////////////////////////////////////////
	//Helpers
	//////////////////////////////////////////////////////////////////////////////
	lang.setObject("nq.getState", getState);//make the function globally accessable
	function getState(level){
		var hashArr = hash().split('.');
		return {
			viewId: hashArr[level*3+0],
			tabId: hashArr[level*3+1],
			selectedObjId: hashArr[level*3+2],
			selectedObjectIdPreviousLevel: hashArr[level*3+0]+'/'+hashArr[level*3-1],
			viewIdPreviousLevel: hashArr[level*3-3]
		};
	}
	function setHashTabId(level, tabId, viewId){
		var hashArr = hash().split('.');
		if(hashArr[level*3+1] == tabId) return;//same
		cookie('viewPane'+viewId+'_selectedChild', tabId);//set the cookie
		
		hashArr[level*3+1] = tabId;
		
		var viewsArr = _nqSchemaMemoryStore.query({parentTabId: tabId, entity: 'view'});//get the views		 
		if(viewsArr.length>0) hashArr[(level+1)*3+0] = viewsArr[0].id;
		else hashArr = hashArr.slice(0,level*3+2);

		//remove anything following this tab in the hash since it is nolonger valid
		hashArr = hashArr.slice(0,level*3+2);
		var newHash = hashArr.join('.');
		//newHash = newHash.replace(/,/g,'.');
		hash(newHash, true);// update history, instead of adding a new record			
	}
	lang.setObject("nq.setHashViewId", setHashViewId);//make the function globally accessable
	function setHashViewId(level, viewId, tabId, selectedObjId){
		//var tabPane = registry.byId('tab'+tabId);
		//document.title = 'NQ - '+(tabPane?tabPane.title+' - ':'')+this.getLabel(item);

		
		var hashArr = hash().split('.');
		hashArr[level*3+1] = tabId;//it may have changed
		hashArr[level*3+2] = selectedObjId;//it will have changed
		if(hashArr[(level+1)*3+0] != viewId){//if its changed
			//remove anything following this level in the hash since it is nolonger valid
			hashArr = hashArr.slice(0,(level+1)*3+0);
			
			hashArr[(level+1)*3+0] = viewId;
			
			//if there is a cookie for this acctab, use if to set the hash tabId (we can prevent unnessasary interperitHash())//FIXME remove set tabId
			var cookieValue = cookie('viewPane'+viewId+'_selectedChild');
			if(cookieValue) hashArr[(level+1)*3+1] = cookieValue.substr(3);
			/*else{//find the first tab and use it
				var tabsArr = _nqSchemaMemoryStore.query({parentViewId: viewId, entity: 'tab'});//get the tabs		 
				if(tabsArr.length>0) hashArr[(level+1)*3+1] = tabsArr[0].id;
			}
			var tabsArr = _nqSchemaMemoryStore.query({parentViewId: viewId, entity: 'tab'});//get the tabs		 
			if(tabsArr.length>0) hashArr[(level+1)*3+1] = tabsArr[0].id;*/
		}

		var newHash = hashArr.join('.');
		cookie('neuralquestState', newHash);
		hash(newHash);			
	}
	lang.setObject("nq.errorDialog", errorDialog);//make the function globally accessable
	function errorDialog(err){
		var dlg = new dijit.Dialog({
			title: err.message, 
			extractContent: true,
			onClick: function(evt){this.hide();},
			content: err.responseText?err.responseText:err.stack
		});
		dlg.show();
		//fx.fadeOut({node: dlg.domNode, delay: 2000, duration: 0, onEnd: function(node){dlg.hide();}}).play();

		throw err.stack; 
	};
});