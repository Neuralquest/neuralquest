define(['dojo/_base/declare', 'dojo/dom-construct', "dojo/on",
        "dojo/when", 'dijit/registry', "app/nqWidgetBase", "dojo/_base/lang",
        "dojo/dom", "dojo/dom-style","dojo/dom-attr", "dojo/json",
        'dgrid/OnDemandGrid',
        'dgrid/Keyboard',
        'dgrid/Selection',
        'dgrid/extensions/DnD',
        'dojo/dnd/Source',
        'dgrid/Tree',
        'dgrid/extensions/ColumnResizer',
        "dgrid/extensions/DijitRegistry",

        'dijit/_editor/plugins/TextColor', 'dijit/_editor/plugins/LinkDialog', 'dijit/_editor/plugins/ViewSource', 'dojox/editor/plugins/TablePlugins'
        /*'dojox/editor/plugins/ResizeTableColumn'*/],
    function(declare, domConstruct, on,
             when, registry, nqWidgetBase, lang, dom, domStyle, domAttr, JSON, OnDemandGrid, Keyboard,
             Selection, DnD, Source, Tree, ColumnResizer, DijitRegistry){

        return declare("nqTreeGrid", [nqWidgetBase],{
            postCreate: function(){
                this.inherited(arguments);
                var self = this;
                if(!self.widget.viewRefs || self.widget.viewRefs.length<1) return;
                var initialized = self.store.get(self.widget.viewRefs[0]).then(function(view){
                    //console.log('VIEW:',view);
                    //console.log(JSON.stringify(view));
                    self.view = view;
                    self.pageHelpTextDiv.innerHTML = view.description;
                    self.treeGrid = new (declare([ OnDemandGrid, Keyboard, Tree, ColumnResizer, DijitRegistry ]))({
                        collection: self.store.filter({_id: 0}),//must return empty array
                        loadingMessage: 'Loading data...',
                        noDataMessage: 'No results found.',
                        //className: "dgrid-autoheight nqTransparent",
                        //selectionMode: 'none',
                        //height: '',
                        columns: {
                            // Render expando icon and trigger expansion from first column
                            name: {
                                label: 'Name',
                                renderExpando: true,
                                //renderCell: lang.hitch(self, self.renderTreeNode),
                                sortable : false,
                                width: 150
                            },
                            properties: {
                                label:'Properties',
                                renderCell: lang.hitch(self, self.renderTreeDetails),
                                //set: lang.hitch(self, self.setForm),
                                sortable : false
                            }
                        },
                        removeRow: function (rowElement) {
                            // destroy our widget during the row removal operation
                            var cellElement = self.treeGrid.cell(rowElement, 'properties').element;
                            var formWidgets = registry.findWidgets(cellElement);
                            formWidgets.forEach(function(widget){
                                //widget.destroyRecursive();
                            });
                            console.log('removeRow', formWidgets);
                            //this.inherited(arguments);
                        }/*,
                        resize: function(){
                            if (arguments.length>0){
                                domGeometry.setMarginBox(this.domNode, arguments[0]);
                            }
                            this.inherited("resize", arguments);
                        }*/
                    }, domConstruct.create("div", null, self.pane.containerNode));
                    self.treeGrid.on("dgrid-error", function(event){nq.errorDialog(event.error);});
                    /*self.treeGrid.on("dgrid-datachange", lang.hitch(self, function(evt) {
                        this.updateClient(evt.rowId, evt.value);
                    }));

                    self.treeGrid.on("refresh", lang.hitch(self, function(evt) {
                        this.pane.resize();
                    }));*/


                    return true;
                });
                when(initialized, function(result){
                    self.createDeferred.resolve(self);//ready to be loaded with data
                }, function(err){self.createDeferred.reject(err)});
            },
            renderTreeNode: function(object, value, node, options) {
                //<i class="fa fa-cloud">gtregfdg</i>
                var labelNode = domConstruct.create("span",null, node);
                //domConstruct.create('img', {style:{float: 'left'}, class: 'editIcon'}, labelNode);
                domConstruct.create('div', {style:{float: 'left'}, innerHTML:object.arrayName}, labelNode);
                domConstruct.create('div', {style:{float: 'left'}, innerHTML:object.name}, labelNode);
            },
            renderTreeDetails: function(object, value, node, options) {
                var self = this;
                var properties = self.view.properties;
                if(object.structuredDocPathArr) object.structuredDocPathArr.forEach(function(pathObj){
                    properties = properties[pathObj.arrayName];
                    if(properties.type == 'array' && properties.items && properties.items.type=='object') {
                        var oneOfArr = properties.items.oneOf;
                        if(oneOfArr) oneOfArr.forEach(function (oneOfobj) {
                            //we have to determine which one we're dealing with
                            //properties = oneOfobj.properties;
                        });
                        if(oneOfArr) properties = oneOfArr[0].properties;
                        else properties = properties.items.properties;
                    }
                });
                self.renderForm(properties, node, object.structuredDocPathArr);
                self.setFromValues(properties, object, node);
            },
            setSelectedObjIdPreviousLevel: function(id){
                this.selectedObjIdPreviousLevel = id;
                // Create a delegate of the original store with a new getChildren method.
                /*var rootCollection = lang.delegate(this.store.filter({_id: value}), {
                    getChildren: function(parent){
                        //var children = rootCollection.getChildren(parent);
                        return rootCollection.dotArray({id:parent._id, arrayName:'tabs'});
                    }
                });*/
                var docCol = this.store.cachingStore.filter({_id: id});
                docCol.on('update', function(event){
                    alert('doc update in treeGrid');
                    /*var obj = event.target;
                     self.onChange(obj);*/
                });
                this.treeGrid.set('collection', docCol);
                //self.setSelectedObjIdPreviousLevelDeferred.resolve(self);
                //return this.setSelectedObjIdPreviousLevelDeferred.promise;
            }
        });

    });
