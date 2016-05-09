require([
'dojo/_base/array', 'dojo/dom-style', 'dojo/_base/fx', 'dojo/ready', 'dojo/topic', "dojo/on", 'dojo/hash', 'dijit/registry', 
'dojo/dom', 'dojo', 'dojo/_base/lang', 'dojo/_base/declare','dojo/_base/array', 'dojo/dom-construct',
'dojo/Deferred', 'dojo/when', "dojo/promise/all", 'dojo/query', 'dijit/layout/BorderContainer',
'dijit/layout/TabContainer', 'dijit/layout/ContentPane', 'dijit/layout/AccordionContainer', "dojo/cookie", "dojo/request",
'app/nqDocStore', 'app/nqProcessChart', 'app/nqClassChart', 'app/nqForm', 'app/nqTable', 'app/nqTree','app/nqDocument','app/nqTreeGrid',
"dojo/json","dijit/Dialog","dijit/form/Form","dijit/form/TextBox","dijit/form/Button","dojo/dom-attr",'dojox/html/styles', 'dojo/query!css2'],
function(arrayUtil, domStyle, fx, ready, topic, on, hash, registry,
		dom, dojo, lang, declare, array, domConstruct,
		Deferred, when, all, query, BorderContainer,
		TabContainer, ContentPane, AccordionContainer, cookie, request,
        nqDocStore, nqProcessChart, nqClassChart, nqForm, nqTable, nqTree, nqDocument, nqTreeGrid,
		JSON, Dialog,Form,TextBox,Button,domattr,styles, css2) {

    var nqStore = new nqDocStore();
    var userName = null;
    ready(function () {
        request.get('/hello').then(function (data) {
            userName = data == '' ? null : data;
            domattr.set('userNameDiv', 'innerHTML', data);
        }, errorDialog);
        topic.subscribe("/dojo/hashchange", interpretHash);
        on(registry.byId('loginButtonId'), 'click', function (event) {
            login();
        });
        on(registry.byId('cancelButtonId'), 'click', function (event) {
            nqStore.abort();
        });
        on(registry.byId('saveButtonId'), 'click', function (event) {
            nqStore.commit();
        });
        on(registry.byId('helpButtonId'), 'change', function (value) {
            if (value) dojox.html.insertCssRule('.helpTextInvisable', 'display:block;', 'nq.css');
            else dojox.html.removeCssRule('.helpTextInvisable', 'display:block;', 'nq.css');
        });

        if (hash() == "") {
            var neuralquestState = cookie('neuralquestState');
            //if(neuralquestState) hash(neuralquestState, true);
            hash(".56f89f625dde184ccfb9fc76....5700046f5dde184ccfb9fc7c", true);
        }
        else interpretHash();
    });
    function interpretHash(_hash) {
        var parentContentPane = registry.byId('placeholder');
        //Recursively fill the parent content pane with boarder container and/or tabs/accordions
        when(drawBorderContainer(parentContentPane, getState(0).pageId, 0), function(res){
            //When the framework is done, start drawing the widgets and providing them with a docId (= selected obj previous level)
            var hashArr = hash().split('.');
            var levels = Math.ceil(hashArr.length/4);//determine the number of levels, rounded to the highest integer
            //For each level in the hash TODO reverse the order
            for(var level = 0; level<levels; level++){
                var state = getState(level);
                //Find the tabContainer that was created for this level's pageId
                var tabContainer = registry.byId(state.pageId);
                var tabPane = getSelectedTabRecursive(tabContainer);//This will poke through sub-pages
                //Find the tab pane that was created for this level's tabNum
                var tabPane = registry.byId(state.pageId+'.'+state.tabNum);
                //Is it really a tabContainer? maker sure the right tab is selected
                if(tabPane) tabContainer.selectChild(tabPane, false);
                //else tabPane = tabContainer;
                when(drawWidgets(tabPane, state.pageId, level), function(res){
                    var widgetsArr = array.filter(registry.toArray(), function(item){
                        return item.pageId == state.pageId && item.tabNum == state.tabNum && item.widNum != undefined;
                    });
                    widgetsArr.forEach(function (widget) {
                        widget.setDocId(state.docIdPreviousLevel);

                        //widget.setSelectedObjIdThisLevel(state.docId);
                    });
                },nq.errorDialog);
            }
        },nq.errorDialog);
    }
    function drawBorderContainer(parentContentPane, pageId, level) {
        if(!pageId) return true;
        if(registry.byId(pageId)){
            var slaveContentPane = registry.byId('slave.'+pageId);
            if(slaveContentPane) return drawBorderContainer(slaveContentPane, getState(level+1).pageId, level+1);
            else return true;
        }
        parentContentPane.destroyDescendants(false);
        //var state = getState(level);
        //console.log('page level', level);
        return nqStore.get(pageId).then(function (pageObj) {
            if(pageObj.divider == 'Horizontal' || pageObj.divider == 'Vertical') {
                var borderContainer = new BorderContainer({
                    //'id' : pageId,
                    'region': 'center',
                    'design': pageObj.divider == 'Vertical' ? 'sidebar' : 'headline',
                    'persist': true,
                    //'class': 'noOverFlow'
                    'style': {width: '100%', height: '100%', overflow: 'hidden', padding: '0px', margin: '0px'}
                });
                //borderContainer.startup();
                var leftPane = new ContentPane({
                    //'id' : 'master'+parentViewOrTabId,
                    'region': pageObj.divider == 'Vertical' ? 'leading' : 'top',
                    'class': 'backgroundClass',
                    'splitter': true,
                    //'class': 'noOverFlow',
                    'style': {width: '200px', overflow: 'hidden', padding: '0px', margin: '0px'}
                });
                var centerPane = new ContentPane({
                    'id' : 'slave.'+pageId,
                    //slaveOf: pageId,
                    'region': 'center',
                    'class': 'backgroundClass',
                    //'content' : '<p>Loading...</p>',
                    //'class': 'noOverFlow'
                    'style': {overflow: 'hidden', padding: '0px', margin: '0px'}
                });
                borderContainer.addChild(leftPane);
                borderContainer.addChild(centerPane);
                parentContentPane.containerNode.appendChild(borderContainer.domNode); //appendChild works better than attaching through create
                borderContainer.startup();//this is a must
                parentContentPane.resize();//this is a must
                drawAccordionsOrTabs(pageObj, leftPane, level);//Fill the left pane with tabs/accordions as needed
                return drawBorderContainer(centerPane,  getState(level+1).pageId, level + 1);//Draw the next level into the center pane
            }
            else {
                //There is no border container at this level, so go ahead and use the parent content pane
                drawAccordionsOrTabs(pageObj, parentContentPane, level);//Fill the parent content pane with tabs/accordions as needed
                return true;
            }
        });
    }

    function drawAccordionsOrTabs(pageObj, parentContentPane, level) {
        var state = getState(level);
        //Is there only one tab? skip the tab container and just use the parent content pane
        if (pageObj.tabs.length <= 1) {
            //parentContentPane.pageId = state.pageId;
            parentContentPane.id = state.pageId;
            //parentContentPane.pageType = 'tabContainer';
            parentContentPane.level = level;
            parentContentPane.tabNum = 0;
        }
        else {
            var container = null;
            var props = {
                //pageId: state.pageId,
                id : state.pageId,
                //pageType: 'tabContainer',
                region: 'center',
                //'class': 'noOverFlow',
                style: {width: '100%', height: '100%', overflow: 'hidden', padding: '0px', margin: '0px'}
                //'persist' : true,//do not use! cookies override our hash tabId
            };
            if(pageObj.accordionOrTab == 'Accordions')container = new AccordionContainer(props);
            else container = new TabContainer(props);

            parentContentPane.addChild(container);
            container.startup();//this is a must
            parentContentPane.resize();//this is a must
            var num = 0;
            pageObj.tabs.forEach(function (tabObj) {
                var state = getState(level);//!!! state get overwitten, not know why
                var tabPane = new ContentPane({
                    id: state.pageId+'.'+num,
                    level: level,
                    tabNum: num,
                    //pageType: 'tabPane',
                    title: tabObj.name,
                    //'content' : '<p>Loading...</p>',
                    'class': 'backgroundClass',
                    style: {overflow: 'hidden', padding: '0px', margin: '0px', width: '100%', height: '100%'}
                });
                container.addChild(tabPane);
                if (num == state.tabNum) container.selectChild(tabPane, false);
                num++;
                if(tabObj.pageId) drawBorderContainer(tabPane, tabObj.pageId, level);
            });

            container.watch("selectedChildWidget", function(name, oval, nval){
                //console.log("selected child changed from ", oval.tabNum, " to ", nval.tabNum);
                nq.setHash(null, pageObj._id, nval.tabNum, null, level);
            });
        }
    }

    function drawWidgets(tabPane, pageId, level) {
        var state = getState(level);
        return nqStore.get(pageId).then(function (pageObj) {
            var widgetPromises = [];
            var widNum = 0;
            var tabObj = pageObj.tabs[state.tabNum];
            if(tabObj.pageId) return drawWidgets(tabPane, tabObj.pageId, level);
            else if(tabObj.widgets){
                tabObj.widgets.forEach(function (widget) {
                    if(!registry.byId(pageId+'.'+state.tabNum+'.'+widNum)) {
                        var createDeferred = new Deferred();
                        widgetPromises.push(createDeferred.promise);
                        var parms = {
                            id: pageId + '.' + state.tabNum + '.' + widNum,
                            pageId: state.pageId,
                            tabNum: state.tabNum,
                            widNum: widNum,
                            level: level,
                            //pageType: 'widget',
                            widget: widget,
                            store: nqStore,
                            createDeferred: createDeferred
                        };
                        if (widget.displayType == 'Document') {
                            var widgetObj = new nqDocument(parms, domConstruct.create('div'));
                            tabPane.addChild(widgetObj);
                        }
                        else if (widget.displayType == 'Form') {
                            var widgetObj = new nqForm(parms, domConstruct.create('div'));
                            tabPane.addChild(widgetObj);
                        }
                        else if (widget.displayType == 'TreeGrid') {
                            var widgetObj = new nqTreeGrid(parms, domConstruct.create('div'));
                            tabPane.addChild(widgetObj);
                        }
                        else if (widget.displayType == 'Table') {
                            var widgetObj = new nqTable(parms, domConstruct.create('div'));
                            tabPane.addChild(widgetObj);
                        }
                        else if (widget.displayType == 'Tree') {
                            var widgetObj = new nqTree(parms, domConstruct.create('div'));
                            tabPane.addChild(widgetObj);
                        }
                        else if (widget.displayType == '3D Class Model') {
                            var widgetObj = new nqClassChart(parms, domConstruct.create('div'));
                            tabPane.addChild(widgetObj);
                        }
                        widNum++;
                    }
                });
            }
            return all(widgetPromises);
        });
    }

    //////////////////////////////////////////////////////////////////////////////
    //Helpers
    //////////////////////////////////////////////////////////////////////////////
    lang.setObject("nq.getState", getState);//make the function globally accessible
    function getState(level){
        var hashArr = hash().split('.');
        return {
            pageIdPreviousLevel: hashArr[level*4-3],
            tabNumPreviousLevel: parseInt(hashArr[level*4-2])?parseInt(hashArr[level*4-2]):0,
            widgetNumPreviousLevel: parseInt(hashArr[level*4-1])?parseInt(hashArr[level*4-1]):0,
            docIdPreviousLevel: hashArr[level*4],
            pageId: hashArr[level*4+1],
            tabNum: parseInt(hashArr[level*4+2])?parseInt(hashArr[level*4+2]):0,
            widgetNum: parseInt(hashArr[level*4+3])?parseInt(hashArr[level*4+3]):0,
            docId: hashArr[level*4+4]
        };
    }

    lang.setObject("nq.errorDialog", errorDialog);//make the function globally accessible
    function errorDialog(err) {
        var content, title;
        if (err.response) {
            title = err.message;
            if (err.response.text)content = err.response.text;
            else content = err.response;
        }
        else {
            title = 'Client Error';
            content = err.message;
        }
        var dlg = new dijit.Dialog({
            title: title,
            extractContent: true,//important in the case of server response, it'll screw up your css.
            onBlur: this.hide(),//click anywhere to close
            content: content
        });
        dlg.show();
        if (!err.response) throw err.stack;//extremely useful for asycronons errors, stack otherwise gets lost
    }
    lang.setObject("nq.setHash", setHash);//make the function globally accessible
    function setHash(docId, pageId, tabNum, widNum, level){
        var tabPane = registry.byId(pageId+'.'+tabNum);
        if(tabPane) document.title = 'NQ - '+tabPane?tabPane.title:'';

        var hashArr = hash().split('.');
        var state = getState(level);
        var parsedArr = [];
        if(pageId && tabNum!=null && state.tabNum != tabNum){//The tabNum has changed
            //get everything in the current hash array fom this level onwards
            var arrFromTab = hashArr.slice(level*4+4);
            //Set the cookie for the current tabNum
            cookie(pageId+'.'+state.tabNum, JSON.stringify(arrFromTab));
            //Get the cookie for the new tabNum
            var jsonString = cookie(pageId+'.'+tabNum);
            if(jsonString) parsedArr = JSON.parse(jsonString);
        }

        //remove anything following this level in the hash since it is no longer valid
        hashArr = hashArr.slice(0,level*4+4);

        if(docId) hashArr[level*4+0] = docId;
        if(pageId) hashArr[level*4+1] = pageId;
		if(tabNum!=null) hashArr[level*4+2] = tabNum;
		if(widNum!=null) hashArr[level*4+3] = widNum;

        //Complete the hashArr with the parsed array we found earlier
        //TODO must make sure the hash array is long enough
        hashArr = hashArr.concat(parsedArr);

        var newHash = hashArr.join('.');
        //var newHash = newHash.replace(/.0./g, "..");//Replace any '.0.' with '..'
        //var newHash = newHash.replace(/.0(?!.*?.0)/, "");//Remove ending '.0'
        //var newHash = newHash.replace(/.(?!.*?.)/, "");//Remove ending '.'doesn't work!
        cookie('neuralquestState', newHash);
        hash(newHash);
    }
    function getSelectedTabRecursive(tabContainer){
        var widgets = registry.findWidgets(tabContainer.containerNode);
        widgets.forEach(function(wid){
            console.log('wid', wid.declaredClass);
        });
        console.log(tabContainer.declaredClass);
        if(tabContainer.declaredClass == 'dijit.layout.ContentPane') {
            if(tabContainer.containerNode.firstChild) return getSelectedTabRecursive(tabContainer.containerNode.firstChild);
            else return tabContainer;
        }
        if(tabContainer.declaredClass == 'dijit.layout.AccordionContainer') return getSelectedTabRecursive(tabContainer.selectedChildWidget);
        if(tabContainer.declaredClass == 'dijit.layout.TabContainer') return getSelectedTabRecursive(tabContainer.selectedChildWidget);
        //Is it a tabContainer? if so, get the selected tab
            //recurse with the selected tab
        //Is it a borderContainer? if so, get the left pane
            //recurse with the left pane
        if(tabContainer.selectedChildWidget)
        return tabContainer;
    }
});