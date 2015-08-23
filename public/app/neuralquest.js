require([
'dojo/_base/array', 'dojo/dom-style', 'dojo/_base/fx', 'dojo/ready', 'dojo/topic', "dojo/on", 'dojo/hash', 'dijit/registry', 
'dojo/dom', 'dojo', 'dojo/_base/lang', 'dojo/_base/declare','dojo/_base/array', 'dojo/dom-construct', 'dojo/_base/declare',
'dojo/Deferred', 'dojo/when', "dojo/promise/all", 'dojo/query', 'dijit/layout/BorderContainer',
'dijit/layout/TabContainer', 'dijit/layout/ContentPane', 'dijit/layout/AccordionContainer', "dojo/cookie", "dojo/request",
'app/nqNewStore', 'app/nqProcessChart', 'app/nqClassChart', 'app/nqForm', 'app/nqTable', 'app/nqTree','app/nqDocument',
'dojo/promise/instrumentation', 'dojox/html/styles', 'dojo/query!css2',
'dojox/store/transaction', "dojo/store/JsonRest" , 'dojo/store/Memory'],
function(arrayUtil, domStyle, fx, ready, topic, on, hash, registry,
		dom, dojo, lang, declare, array, domConstruct, declare,  
		Deferred, when, all, query, BorderContainer,// Trackable,
		TabContainer, ContentPane, AccordionContainer, cookie, request,
		nqNewStore, nqProcessChart, nqClassChart, nqForm, nqTable, nqTree, nqDocument,
		instrumentation, styles, css2,
		 transaction, JsonRest, Memory) {
	
	var nqDataStore = new nqNewStore();
	//var nqDataStore = declare([new nqNewStore(), Trackable]);
	//var nqDataStore = Observable(new nqNewStore());
	//var nqDataStore = Observable(new nqNewStore());
	//var transaction = nqDataStore.transaction();


	var itemStore;
	var self = this;

	ready( function() {
		// summary:
		//		Initialize
		//		Setup listerners, prefetch data which is often used, determin landing page
		var transactionLogStore = new Memory();
		var masterItemStore = new JsonRest({target: '/item',name: 'item'});
		var localItemStore = new Memory();
		itemStore = transaction({
			masterStore: masterItemStore,
			cachingStore: localItemStore,
			transactionLogStore: transactionLogStore
		});

		topic.subscribe("/dojo/hashchange", interpretHash);
		on(registry.byId('cancelButtonId'), 'click', function(event){nqDataStore.abort();});
		on(registry.byId('saveButtonId'), 'click', function(event){nqDataStore.commit();});
		on(registry.byId('helpButtonId'), 'change', function(value){
			if(value) dojox.html.insertCssRule('.helpTextInvisable', 'display:block;', 'nq.css');
			else dojox.html.removeCssRule('.helpTextInvisable', 'display:block;', 'nq.css');
		});

		when(nqDataStore.preFetch(), function(results){
			//fx.fadeOut({node: 'loadingOverlay',	onEnd: function(node){domStyle.set(node, 'display', 'none');}}).play();	
			domStyle.set('loadingOverlay', 'display', 'none');
			if(hash() == "") {
				var neuralquestState = cookie('neuralquestState');
				if(neuralquestState) hash(neuralquestState, true);
				else hash("842.1784.702.2485", true);
			}
			else interpretHash();
		}, errorDialog);

	});
	function interpretHash(_hash){
		// summary:
		//		Interpret the hash change. The hash consists of sets of threes: viewId.tabId.selectedObjectId.
		//		Each set is interpreted consecutively.
		//		This method is initially called by on hash change and subsequently by ourselves with incrementing level
		// hash: String
		//		The current hash
		// lvl: Number
		//		The level we are currently processing. Defaults to 0 as is the case when we are called by on hash change topic
		// returns: Promise
		//		All of the page elements of the underlaying levels are completed 
		//var currentHash = hash();		
		//console.log('hash', _hash);
		when(processHashLevelRecursive(0), function(result){
			var hashArr = hash().split('.');
			var levels = Math.ceil(hashArr.length/3);//determine the number of levels, rounded to the highest integer
			for(var level = levels-1; level>=0; level--){
				setTimeout(drawWidgets(level));//allow the browser to redraw the page. Does this really work?
				//drawWidgets(level);
			}
		}, errorDialog);
		
	}	
	function processHashLevelRecursive(level){
		var state = getState(level);
		//console.log('state', state);
		if(!state.viewId) return false;//nothing left to display
		// if the view pane already exists we can simply go on to the next level
		if(registry.byId('viewPane'+state.viewId)) return processHashLevelRecursive(level+1);		
		// We're filling a slave, clean it first. It may have been used by another view before
		var parentContentPane; 
		if(!state.viewIdPreviousLevel) parentContentPane = registry.byId('placeholder');
		else parentContentPane = registry.byId('slave'+state.viewIdPreviousLevel);
		if(!parentContentPane) parentContentPane = registry.byId('slave'+state.tabIdPreviousLevel);
		if(!parentContentPane) return false; 
		parentContentPane.destroyDescendants(false);
		
		//are we creating an accordion container in a border container or a tab container?
		return itemStore.get(538+'/'+state.viewId).then(function(view){
			var viewPaneCreated;
			if(view.accordionOrTab=='Accordion in Border Container') viewPaneCreated = createAccordionInBorderContainer(state.viewId, parentContentPane, level);
			else viewPaneCreated = createTabs(state.viewId, parentContentPane, level);
			return when(viewPaneCreated, function(newParentContentPane){
				parentContentPane.resize();//this is a must
				return processHashLevelRecursive(level+1);//try the next level
			});
		});
	}
	function drawWidgets(level){		
		var WIDGETS_ATTRCLASS = 99;
		
		var state = getState(level);
		if(!state.viewId) return true;
		var selectedTabId = getSelectedTabRecursive(state.viewId);
        return itemStore.query({sourceId: selectedTabId, type: 'ordered', destClassId: WIDGETS_ATTRCLASS}).then(function(widgetsArr){
			//when we've got all the child widgets that belong to this tab, create them
			for(var i=0;i<widgetsArr.length;i++){
				var widget = widgetsArr[i];
				when(createNqWidget(widget, selectedTabId, state.viewId, level), function(widgetObj){
					//when the widget is created tell it which object was selected on the previous level
					//widget types will respond diferently: fill the form, set the query for the table, recreate the tree, fly to the object in 3D, etc.
					when(widgetObj.setSelectedObjIdPreviousLevel(state.selectedObjectIdPreviousLevel), function(wid){
						wid.setSelectedObjIdThisLevel(state.selectedObjId);
					}, errorDialog);
				}, errorDialog);
			}
			return widgetsArr;
		});
	}
	function getSelectedTabRecursive(paneId){
		var tabContainer = registry.byId('viewPane'+paneId);
		if(!tabContainer) return false;
		var tabId;
		if(tabContainer.selectedChildWidget) tabId = tabContainer.selectedChildWidget.id;
		else tabId = tabContainer.containerNode.firstChild.id;
		if(!tabId) return false;
		var subTab = getSelectedTabRecursive(tabId.substring(3));
		if(subTab) return subTab;// there's a selected tab below us, so return it's id
		else return tabId.substring(3);//we are at the bottom, so return our id		
	}
	function createAccordionInBorderContainer(parentViewOrTabId, parentContentPane, level){
		// summary:
		//		Add an accordion container in a border container to the parent content pane
		//		The right side of the border container can be used to display content based on a selected object on the left side.
		//		If there is only one accordion, then no container is drawn, just a content  pane.
		//		Will return immediately if its already been created
		// parentContentPane: ContentPane
		//		The content pane we will be drawing in
		// viewId: Number
		//		
		// selectedTabId: Number
		//		The id of the accordion widget that should be selected according to the hash
		// level: Number
		//		The level we are curently processing (used to update the hash after something has been clicked)
		// returns: Promise
		//		The promise will result in the id of the selected accordion 
		
		var ACCORDIONTABS_ATTRCLASS = 90;

		var state = getState(level);
		var viewId = state.viewId;
		return itemStore.query({sourceId: parentViewOrTabId, type: 'ordered', destClassId: ACCORDIONTABS_ATTRCLASS}).then(function(tabsArr){
			if(tabsArr.length==0) return false;
					
			var design = 'sidebar';//obtain horizontal, vertical, none from viewDef?
			var borderContainer = new BorderContainer( {
				'id' : 'borderContainer'+parentViewOrTabId,
				'region' : 'center',
				'design' : design,
				'persist' : true,
				//'class': 'noOverFlow'
				'style' : {width: '100%', height: '100%', overflow: 'hidden', padding: '0px', margin: '0px'}
			});
			var leftPane = new ContentPane( {
				'id' : 'master'+parentViewOrTabId,
				'region' : 'leading',
				'class' : 'backgroundClass',
				'splitter' : true,
				//'class': 'noOverFlow',
				'style' : {width: '200px',overflow: 'hidden',padding: '0px', margin: '0px'}
			});
			var centerPane = new ContentPane( {
				'id' : 'slave'+parentViewOrTabId,
				'region' : 'center',
				'class' : 'backgroundClass',
				//'content' : '<p>Loading...</p>',
				//'class': 'noOverFlow'
				'style' : {overflow: 'hidden',padding: '0px', margin: '0px'}
			});
			borderContainer.addChild(leftPane);
			borderContainer.addChild(centerPane);
			//parentContentPane.addChild(borderContainer);
			parentContentPane.containerNode.appendChild(borderContainer.domNode); //appendChild works better than attaching through create
		
			var accordianContainer;
			if(tabsArr.length==1){// this is really only to have palce to store viewPane+viewObj.id. Is there a better way?
				accordianContainer = new ContentPane( {
					'id' : 'viewPane'+parentViewOrTabId,
					'region' : 'center',
					'style' : {width: '100%',height: '100%',overflow: 'hidden',padding: '0px', margin: '0px'}
				});
			}
			else {
				accordianContainer = new AccordionContainer( {
					'id' : 'viewPane'+parentViewOrTabId,
					'region' : 'center',
					'duration' : 0,//animation screws out layout. Is there a better solution?
					//'persist' : true,//cookies override our hash tabId
					'class': 'noOverFlow',
					'style' : {width: '100%',height: '100%',overflow: 'hidden',padding: '0px', margin: '0px'}
				});
			}
			leftPane.addChild(accordianContainer);
			for(var i=0;i<tabsArr.length;i++){
				var tab = tabsArr[i];
				//console.log('accId', tab, 'parentViewOrTabId', parentViewOrTabId, 'level',level);
				var tabPane = new ContentPane( {
					'id' : 'tab'+tab._id,
					'title' : tab.name,
					'selected' : tab._id==state.tabId?true:false,
					'class' : 'backgroundClass',
					'style' : {overflow: 'hidden', padding: '0px', margin: '0px', width: '100%', height: '100%'}
				});
				accordianContainer.addChild(tabPane);
				accordianContainer.watch("selectedChildWidget", function(name, oval, nval){
					//console.log("selected child changed from ", oval.title, " to ", nval.title);
					var tabId = (nval.id).substring(3);//why is this called so offten? probably cant hurt
					setHashTabId(level, tabId, viewId); // this will trigger createNqWidget
				});
			};

			//parentContentPane.addChild(container);
			//parentPane.addChild(container);
			accordianContainer.startup();
			borderContainer.startup();
			//if(tabsArr.length>1) accordianContainer.resize();

			return centerPane;


		});
	}
	function createTabs(parentViewOrTabId, parentContentPane, level){
		// summary:
		//		Add a tab container to the parent content pane
		//		If there is only one tab, then no container is drawn, just a content  pane.
		//		Will return immediately if its already been created
		// parentContentPane: ContentPane
		//		The content pane we will be drawing in
		// viewId: Number
		//		
		// selectedTabId: Number
		//		The id of the tab widget that should be selected accoording to the hash
		// level: Number
		//		The level we are curently processing (used to update the hash after something has been clicked)
		// returns: Promise
		//		The promise will result in the id of the selected tab
		
		//get the Display Type id that this widget has as an attribute
		
		var ACCORDIONTABS_ATTRCLASS = 90;

		var state = getState(level);
		var viewId = state.viewId;

		return itemStore.query({sourceId: parentViewOrTabId, type: 'ordered', destClassId: ACCORDIONTABS_ATTRCLASS}).then(function(tabsArr){
			if(tabsArr.length==0) return false;
			
			var container;
			if(tabsArr.length==1){// this is really only to have palce to store viewPane+viewId. Is there a better way?
				container = new ContentPane( {
					'id' : 'viewPane'+parentViewOrTabId,
					'region' : 'center'
				});
			}
			else {
				container = new TabContainer( {
					'id' : 'viewPane'+parentViewOrTabId,
					//'persist' : true,//cookies override our hash tabId
					'region' : 'center'
				});
			}
			parentContentPane.addChild(container);
			container.startup();
			var subTabPromisses = [];
			for(var i=0;i<tabsArr.length;i++){
				var tab = tabsArr[i];
				if(tab._id==state.tabId) selectedFound = tab._id;
				//console.log('tabId', tabId, 'parentViewOrTabId', parentViewOrTabId, 'level',level);
				var tabPane = new ContentPane( {
					'id' : 'tab'+tab._id,
					'title' : tab.name,
					//'selected' : tab._id==state.tabId?true:false,
					'class' : 'backgroundClass',
					'style' : {overflow: 'hidden', padding: '0px', margin: '0px', width: '100%', height: '100%'}
				});
				container.addChild(tabPane);
				container.watch("selectedChildWidget", function(name, oval, nval){
					console.log("selected child changed from ", oval.title, " to ", nval.title);
					var tabId = (nval.id).substring(3);//why is this called so offten? probably cant hurt
					setHashTabId(level, tabId, viewId); // this will trigger createNqWidget
				});
				/*subTabPromisses.push(
					//are we creating an accordion container in a border container or a tab container?
					if(tab.accordionOrTab=='Accordion in Border Container')  return(createAccordionInBorderContainer(tab._id, tabPane, level));
					else return(createTabs(tab._id, tabPane, level));
				);*/
			};
			/*if(selectedFound && container.selectChild) container.selectChild(registry.byId('tab'+selectedFound));//must be set programmatically
			return when(all(subTabPromisses), function(result){
				//tell the super tabPane that it should select our superTab because its subtab is also selected
				if(selectedFound) return parentViewOrTabId;
				else return false;
			});*/
            return container;
			//return when(all(subTabPromisses));
		});
	}
	function createNqWidget(widget, tabId, viewId, level) {
        // summary:
        //		Add a nqWidget to the content pane, depending on DISPLAYTYPE_ATTR
        //		Will return immediately if its already been created
        // widgetId: Number
        //		The id of the widget that the selected tab is requesting
        // tabId: Number
        //		The currently selected tab (used to update the hash after something has been clicked)
        // viewId: Number
        //		The id of the view that the selected object is requesting
        // level: Number
        //		The level we are curently processing (used to update the hash after something has been clicked)
        // returns: Deferred
        //		The deferred will result in the widget after it has been created, or immediately if it is already there

        // if the widget already exists we can simply return widgets
        var widgetObj = registry.byId('nqWidget' + widget._id);
        if (widgetObj) return widgetObj;
        var tab = registry.byId('tab' + tabId);

        var state = getState(level);
        var tabNode = dom.byId('tab' + tabId);
        var createDeferred = new Deferred();

        if (widget.displayTypes == 'Document'){
            widgetObj = new nqDocument({
                id: 'nqWidget' + widget._id,
                store: itemStore,
                createDeferred: createDeferred, //tell us when your done by returning the widgetObj
                widgetId: widget._id,
                tabId: tabId // used by resize
            }, domConstruct.create('div'));
            tab.addChild(widgetObj);
        }
        if (widget.displayTypes == 'Form'){
            widgetObj = new nqForm({
                id: 'nqWidget'+widget._id,
                store: itemStore,
                createDeferred: createDeferred, //tell us when your done by returning the widgetObj
                widgetId: widget._id,
                //viewId: viewId,
            }, domConstruct.create('div'));
            tab.addChild(widgetObj);
        }
        if (widget.displayTypes ==  'Table'){
            widgetObj = new nqTable({
                id: 'nqWidget'+widget._id,
                store: itemStore,
                createDeferred: createDeferred, //tell us when your done by returning the widgetObj
                widgetId: widget._id,
                selectedObjIdPreviousLevel: state.selectedObjectIdPreviousLevel,//dgrid needs an initial query
                level: level, // used by onClick
                tabId: tabId, // used by onClick
                query: query
            }, domConstruct.create('div'));
            tab.addChild(widgetObj);
        }
        if (widget.displayTypes == 'Tree'){
            widgetObj = new nqTree({
                id: 'nqWidget'+widget._id,
                store: itemStore,
                createDeferred: createDeferred, //tell us when your done by returning the widgetObj
                widgetId: widget._id,
                selectedObjIdPreviousLevel: state.selectedObjectIdPreviousLevel,//tree needs an initial query
                level: level, // used by onClick
                tabId: tabId, // used by onClick
            }, domConstruct.create('div'));
            tab.addChild(widgetObj);
            widgetObj.startup();
            createDeferred.resolve(widgetObj);
        }
        if (widget.displayTypes == 'Process Model'){
            widgetObj = new nqProcessChart({
                id: 'nqWidget'+widget._id,
                store: itemStore,
                createDeferred: createDeferred, //tell us when your done by returning the widgetObj
                //viewObj: viewObj,
                tabId: tabId, // used by resize
                //orgUnitRootId: '850/494', // Process Classes
                //orgUnitViewId: '1868',
                //orgUnitNameAttrId: '1926',
                //stateRootId: '2077/443',
                //stateViewId: '2077',
                //stateNameAttrId: '2081'
                //skyboxArray: [ 'img/Neuralquest/space_3_right.jpg', 'img/Neuralquest/space_3_left.jpg', 'img/Neuralquest/space_3_top.jpg' ,'img/Neuralquest/space_3_bottom.jpg','img/Neuralquest/space_3_front.jpg','img/Neuralquest/space_3_back.jpg']
            }, domConstruct.create('div'));
            tab.addChild(widgetObj);
            //widgetObj.startup();
        }
        if (widget.displayTypes == '3D Class Model'){
            widgetObj = new nqClassChart({
                id: 'nqWidget'+widget._id,
                store: itemStore,
                createDeferred: createDeferred, //tell us when your done by returning the widgetObj
                viewId: viewId,
                tabId: tabId, // used by resize
                //skyboxArray: [ 'img/Neuralquest/space_3_right.jpg', 'img/Neuralquest/space_3_left.jpg', 'img/Neuralquest/space_3_top.jpg' ,'img/Neuralquest/space_3_bottom.jpg','img/Neuralquest/space_3_front.jpg','img/Neuralquest/space_3_back.jpg']
            }, domConstruct.create('div'));
            tab.addChild(widgetObj);
            //widgetObj.startup();
        }
        return createDeferred.promise;
	}	
	//////////////////////////////////////////////////////////////////////////////
	//Helpers
	//////////////////////////////////////////////////////////////////////////////
	lang.setObject("nq.getState", getState);//make the function globally accessable
	function getState(level){
		var hashArr = hash().split('.');
		return {
			viewId: parseInt(hashArr[level*3+0]),
			tabId: parseInt(hashArr[level*3+1]),
			selectedObjId: parseInt(hashArr[level*3+2]),
			//selectedObjectIdPreviousLevel: parseInt(hashArr[level*3-1]),
			selectedObjectIdPreviousLevel: hashArr[level*3-1],
			viewIdPreviousLevel: parseInt(hashArr[level*3-3]),
			tabIdPreviousLevel: parseInt(hashArr[level*3-2])
			/*viewId: hashArr[level*3+0],
			tabId: hashArr[level*3+1],
			selectedObjId: hashArr[level*3+2],
			selectedObjectIdPreviousLevel: hashArr[level*3-1],
			viewIdPreviousLevel: hashArr[level*3-3]*/
		};
	}
	function setHashTabId(level, tabId, viewId){
		var hashArr = hash().split('.');
		if(hashArr[level*3+1] == tabId) return;//same
		cookie('viewPane'+viewId+'_selectedChild', tabId);//set the cookie
		
		hashArr[level*3+1] = tabId;
		
		//var viewsArr = _nqSchemaMemoryStore.query({parentTabId: tabId, entity: 'view'});//get the views		 
		//if(viewsArr.length>0) hashArr[(level+1)*3+0] = viewsArr[0].id;
		//else hashArr = hashArr.slice(0,level*3+2);
		hashArr = hashArr.slice(0,level*3+2);

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
//		hashArr[level*3+1] = tabId;//it may have changed
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
			extractContent: true,//important in the case of server response, it'll screw your css. 
			onClick: function(evt){this.hide();},//click anywhere to close
			content: err.response.text?err.response.text:err.stack
		});
		dlg.show();
		if(!err.responseText) throw err.stack;//extremely useful for asycronons errors, stack otherwise gets lost
	};
	
	
//    var transaction = transactionalCellStore.transaction();
//    transactionalCellStore.put(someUpdatedProduct);
 //   ... other operations ...
//    transaction.commit();	
	
	lang.setObject("nq.test", test);//make the function globally accessable
	function test(){
		nqDataTransStore.test();

		
		/*
		var self = this;
		var transaction = nqDataStore.trans();
		nqDataStore.addTransactionalCellStore({name:'OneName', type:0});
		nqDataStore.addTransactionalCellStore({name:'TwoName', type:0});
		var updateObjectId = nqDataStore.addTransactionalCellStore({name:'ThreeName', type:0});
		var removeObject = nqDataStore.addTransactionalCellStore({name:'FourName', type:0});
		//var obj = nqDataStore.getTransactionalCellStore(updateObjectId);
		//obj.name = 'NewThreeName';
		//nqDataStore.putTransactionalCellStore(obj);
		transaction.commit();	
		
		 when(updateObject, function(obj){
			obj.name = 'NewThreeName';
			nqDataStore.putTransactionalCellStore(obj);
			transaction.commit();	
			
		});
		
		//var result1 = nqDataStore.getChildren({id: 1016, viewId: 846});
		var result1 = nqDataStore.query({parentId: 1016, viewId: 846});
		result1.observe(function(obj, removedFrom, insertedInto){
			console.log("observe result1 The Identifying The...1016", ": ", obj, removedFrom, insertedInto);
		});

		//var result2 = nqDataStore.getChildren({id: 2453, viewId: 846});
		var result2 = nqDataStore.query({parentId: 2453, viewId: 846});
		result2.observe(function(obj, removedFrom, insertedInto){
			console.log("observe result2 The Bain...2453", ": ", obj, removedFrom, insertedInto);
		});
		var result3 = nqDataStore.query({sourceFk: 1016, type:8});
		result3.observe(function(obj, removedFrom, insertedInto){
			console.log("observe on result3...1016", ": ", obj, removedFrom, insertedInto);
		});
		var result4 = nqDataStore.query({sourceFk: 2453, type:8});
		result4.observe(function(obj, removedFrom, insertedInto){
			console.log("observe on result4...2453", ": ", obj, removedFrom, insertedInto);
		});

		when(nqDataStore.getAssoc(4597), function(assoc){
			console.log('assoc before update',assoc);
			assoc.sourceFk = 2453;
			assoc.type = ORDERED_ASSOC;
			nqDataStore.put(assoc);
			console.log('RESULTS');
			when(result1, function(children){
				console.log('result1 Identifying The..');
				console.log(children);
			});
			when(result2, function(children){
				console.log('result2 The Bain...');
				console.log(children);
			});
			when(result3, function(children){
				console.log('result3 Identifying The..');
				console.log(children);
			});
			when(result4, function(children){
				console.log('result4 The Bain...');
				console.log(children);
			});
			console.log('GETCHILDREN');
			when(nqDataStore.getChildren({id: 1016, viewId: 846}), function(children){
				console.log('children of Identifying The..');
				console.log(children);
			});
			when(nqDataStore.getChildren({id: 2453, viewId: 846}), function(children){
				console.log('children of The Bain...');
				console.log(children);
			});
		});
		/*;
			when(nqDataStore.getAssoc(4597), function(assoc1){
				console.log('after update',assoc1);

			});
		when(nqDataStore.query({sourceFk: 2453, type:8}), function(assocsArr){
			console.dir(assocsArr);
		});
		*/
	};
	
	CLASS_TYPE = 0;
	OBJECT_TYPE = 1;	
	// Primitive Assoc types (as used by the Assoc table)
	PARENT_ASSOC = 3;			//TO ONE
	ATTRIBUTE_ASSOC = 4;		//TO ONE
	MAPSTO_ASSOC = 5;			//TO ONE
	DEFAULT_ASSOC = 6;			//TO ONE
	ONETOONE_ASSOC = 7;			//TO ONE
	ORDERED_ASSOC = 8;			//TO MANY
	NEXT_ASSOC = 9;				//TO ONE Only used internaly
	MANYTOMANY_ASSOC = 10;		//TO MANY
	ONETOMANY_ASSOC = 11;		//TO MANY
	OWNS_ASSOC = 12;			//TO MANY
	// Pseudo Assoc tppes (inverse of the real assocs)
	SUBCLASSES_PASSOC = 15;		//TO MANY
	ATTRIBUTE_OF_PASSOC = 16;	//TO MANY
	MAPPED_TO_BY_PASSOC = 17;	//TO MANY
	DEFAULT_OF_PASSOC = 18;		//TO MANY
	ONETOONE_REVERSE_PASSOC = 19;//TO ONE
	ORDERED_PARENT_PASSOC = 20;	//TO ONE
	PREVIOUS_PASSOC = 21;		//TO ONE
	MANYTOMANY_REVERSE_PASSOC = 22;//TO MANY
	MANYTOONE_PASSOC = 23;		//TO ONE
	OWNED_BY_PASSOC = 24;		//TO ONE
	//Special
	INSTANTIATIONS_PASSOC = 27;	//TO MANY
	THE_USER_PASSOC = 28;		//TO ONE
	BYASSOCTPE_PASSOC = 30; 	//TO MANY		
	ASSOCS_PASSOC = 31; 		//TO MANY		

	
	
	
	
});
