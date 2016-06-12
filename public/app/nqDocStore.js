define(['dojo/_base/declare', "dojo/_base/lang", "dojo/_base/array", "dojo/when", "dojo/promise/all", 'dijit/registry',
		'dstore/RequestMemory', 'dstore/SimpleQuery', 'dstore/QueryMethod', 'dstore/QueryResults'],
function(declare, lang, array, when, all, registry,
		 RequestMemory, SimpleQuery, QueryMethod, QueryResults){

    return declare("nqDocStore", [RequestMemory], {
        target: '/documents',
        idProperty: '_id',
        constructor: function () {
            this.root = this;
            this.cachingStore.getChildren = function(parent){
                var filter = {};
                for(var attrName in parent){
                    if(attrName == 'structuredDocPathArr') continue;
                    var attrProps = parent[attrName];
                    if(Array.isArray(attrProps)) {
                        var childrenArr = parent[attrName];
                        var idx = 0;
                        childrenArr.forEach(function(childObj){
                            //childObj.arrayName = parent.arrayName?parent.arrayName+'.'+attrName:attrName;

                            var structuredDocPathArr = [];
                            if(parent.structuredDocPathArr) structuredDocPathArr = parent.structuredDocPathArr.slice(0);//clone
                            structuredDocPathArr.push({arrayName:attrName,idx:idx});
                            childObj.structuredDocPathArr = structuredDocPathArr;
                            idx++;
                        });
                        filter = {data: childrenArr}
                    }
                }
                return this.dotArray(filter);
            };
            this.cachingStore.dotArray = new QueryMethod({
                type: 'dotArray',
                querierFactory: function(filter){
                    return function (data) {
                        return filter.data;
                        //return data[filter._id][filter.arrayName];
                    };
                }
            });
            this.mayHaveChildren = function(obj) {
                return true;
            }
        },
        add: function (_item, directives) {
            this.enableTransactionButtons();
            var item = {};
            if(_item) item = _item;
            else if(directives.schema){
                item._id = this.makeObjectId();
                for(var propName in directives.schema.properties){
                    var prop = directives.schema.properties[propName];
                    if(prop.default){
                        item[propName]= prop.default;
                    }
                }
                if(directives.schema.filter){
                    var docFilter = directives.schema.filter;
                    if(docFilter.type == 'isA') item.parentId = docFilter.args[0];
                }
                if(directives.schema.childrenFilter){
                    var docFilter = directives.schema.childrenFilter;
                    if(docFilter.type == 'in') {
                        var key = docFilter.args[0];
                        var arrayName = docFilter.args[1];
                        var parentObj = this.cachingStore.getSync(directives.parentId);
                        var fkArray = parentObj[arrayName];
                        if(!fkArray) fkArray = [];
                        fkArray.push(item[key]);
                        parentObj[arrayName] = fkArray;
                        this.cachingStore.put(parentObj);
                    }
                }
                if(directives.ownerId){
                    item.ownerId = directives.ownerId;
                }
            }
            this.cachingStore.add(item);
            //this.processDirectives(item, directives);
            //this.emit('add', {target:item, directives:directives});
        },
        put: function (item, directives) {
            this.enableTransactionButtons();
            if(!directives.viewId) directives.viewId = item._viewId;//TODO pastItem should send viewID in directives
            this.itemsColl.put(item, directives);
            this.processDirectives(item, directives);
            //this.emit('update', {target:item, directives:directives});
        },
        remove: function (item, directives) {
            this.enableTransactionButtons();
            if(directives) this.processDirectives(item, directives);
            this.itemsColl.remove(item._id, directives);
            this.emit('remove', {target:item, directives:directives});
        },
        processDirectives: function(object, directives){
            if(!directives) return;
            var self = this;
            var viewId = directives.viewId;
            var movingObjectId = object._id;
            var oldParentId = directives.oldParent?directives.oldParent._id:undefined;
            var newParentId = directives.parent?directives.parent._id:undefined;
            //var newParentId = directives.parent.id;
            var beforeId = directives.before?directives.before._id:undefined;

            return this.get(viewId).then(function(view){
                //TODO must merge
                var assocType = view.toManyAssociations;
                if(!assocType) assocType = view.toOneAssociations;
                var destClassId = view.mapsTo;
                if(assocType == 'ordered'){
                    if(oldParentId){
                        if(newParentId){
                        }
                        else{//no new parent means we are deleting the association
                        }
                    }
                    else{//no oldParent means we're creating a new cell with a new association
                        if(newParentId) {
                        }
                    }
                }
                else{
                    if(oldParentId == newParentId) return;
                    if(oldParentId){
                        if(newParentId){
                        }
                        else{//no new parent means we are deleting the association
                        }
                    }
                    else if(newParentId){//new assoc
                    }
                }
            });
        },
        getRootCollection: function () {

        },
        getParentClass: function(id) {
            var self = this;
            var parentFilter = self.Filter().contains('children', [id]);
            var parentCollection = self.filter(parentFilter);
            return parentCollection.fetch().then(function(parentsArr){
                if(parentsArr.length>1) throw new Error('More than one parent found');
                else if(parentsArr.length==1) return parentsArr[0];
                else return null;//no parent, we are at the root
            });
        },
        getSchemaForView: function (viewId) {
            if(!viewId) return{};
            var self = this;
            return self.get(viewId).then(function(viewObj){
                if(!viewObj) throw new Error('View Object not found');
                //console.log('viewObj',viewObj);
                var inheritedClassSchemaPromise = {};
                if(viewObj.filter && viewObj.filter.type && viewObj.filter.type == 'isA'){
                    var mapsToId = viewObj.filter.args[0];//TODO should be able to deal with multiple levels
                    inheritedClassSchemaPromise = self.getInheritedClassSchema(mapsToId);
                }
                return when(inheritedClassSchemaPromise, function(inheritedClassSchema){
                    var schema = lang.clone(viewObj);
                    schema.properties = {};
                    schema.templateObj = {};
                    schema.required = [];
                    for(var propName in viewObj.properties){
                        var viewObjProp = viewObj.properties[propName];
                        var classProp = inheritedClassSchema.properties?inheritedClassSchema.properties[propName]:null;
                        if(!classProp) {
                            schema.properties[propName] = lang.clone(viewObj.properties[propName]);
                        }
                        else{
                            var viewReadOnly = true;
                            if(classProp.readOnly != undefined) viewReadOnly = classProp.readOnly;
                            else if(viewObjProp.readOnly != undefined) viewReadOnly = viewObjProp.readOnly;
                            classProp.readOnly = viewReadOnly;
                            schema.properties[propName] = classProp;
                       }
                    }
                    schema.required = schema.required.concat(schema.required, inheritedClassSchema.required);
                    //console.log('SCHEMA');
                    //console.dir(schema);
                    return schema;
                });
            });
        },
        getAncestors: function(id) {
            var self = this;
            return this.get(id).then(function(classObj){
                if(classObj.parentId) return self.getAncestors(classObj.parentId).then(function(ancestorsArr){
                    ancestorsArr.unshift(classObj);//add to the beginning
                    return ancestorsArr;
                });
                else return [classObj];//no parent, we are at the root
            });
        },
        getInheritedClassSchema: function(id){
            return this.getAncestors(id).then(function(ancestorsArr){
                var inheritedClassSchema = {
                    $schema: "http://json-schema.org/draft-04/schema#",
                    properties:{},
                    required:[],
                    additionalProperties: false
                };
                ancestorsArr.forEach(function(ancestor){
                    //combine the the two class.properties, there should be no overlap. If there is, the parent is leading
                    lang.mixin(inheritedClassSchema.properties, ancestor.properties);
                    //merge.recursive(inheritedClassSchema.properties, ancestor.properties);
                    //combine the to class.required arrays. There should be no overlap
                    if(ancestor.required) inheritedClassSchema.required = inheritedClassSchema.required.concat(inheritedClassSchema.required, ancestor.required);
                });
                return inheritedClassSchema;
            });
        },
        isASync: function(doc, id) {
            if(doc._id == id) return true;
            if(!doc.parentId) return false;
            var parentDoc =  this.cachingStore.getSync(doc.parentId);
            return this.isASync(parentDoc, id);
        },
        isA: function(doc, id) {
            var self = this;
            if(doc._id == id) return true;
            if(!doc.parentId) return false;
            return this.get(doc.parentId).then(function(parentDoc){
                return self.isA(parentDoc, id);
            });
        },
        getInstances: function(id) {

        },
        getSubclasses: function(id) {

        },
        buildFilterFromQuery: function(parentObj, docQuery) {
            var self = this;
            for(var filterType in docQuery){
                var docFilter = docQuery[filterType];
                switch (filterType) {
                    case 'eq':
                        for(var key in docFilter){
                            var propName = docFilter[key];
                            var value = parentObj[propName];
                            return self.Filter().eq(key, value);
                        }
                        break;
                    case 'and':
                        var firstDocQuery = docFilter[0];
                        var secondDocQuery = docFilter[1];
                        var firstFilter = this.buildFilterFromQuery(parentObj, firstDocQuery);
                        var secondFilter = this.buildFilterFromQuery(parentObj, secondDocQuery);
                        if (firstFilter && secondFilter) return self.Filter().and(firstFilter, secondFilter);
                        break;
                    case 'or':
                        var firstDocQuery = docFilter[0];
                        var secondDocQuery = docFilter[1];
                        var firstFilter = this.buildFilterFromQuery(parentObj, firstDocQuery);
                        var secondFilter = this.buildFilterFromQuery(parentObj, secondDocQuery);
                        if (firstFilter && secondFilter) return self.Filter().or(firstFilter, secondFilter);
                        if (firstFilter) return firstFilter;
                        if (secondFilter) return secondFilter;
                        break;
                    case 'in':
                        for(var key in docFilter){
                            var idArrName = docFilter[key];
                            var idArr = parentObj[idArrName];
                            if(!idArr) return;
                            return this.Filter().in(key, idArr);
                        }
                        break;
                    case 'isA':
                        return this.Filter(function (obj) {
                            if(obj.docType == 'class') return false;
                            var classId = docFilter[key];
                            return self.isASync(obj, classId);
                        });
                        break;
                    case 'view':
                        var subView = this.cachingStore.getSync(docFilter);
                        if (subView && subView.childrenQuery) {
                            return this.buildFilterFromQuery(parentObj, subView.childrenQuery);
                        }
                        break;
                    default:
                        break;
                }
            }
        },
        /*buildFilter: function(parentObj, docFilter) {
            var self = this;
            var filterType = docFilter.type;
            switch (filterType) {
                case 'eq':
                    var key = docFilter.args[0];
                    var propName = docFilter.args[1];
                    var value = parentObj[propName];
                    return self.Filter().eq(key, value);
                    break;
                case 'and':
                    var firstDocFilter = docFilter.args[0];
                    var secondDocFilter = docFilter.args[1];
                    var firstFilter = this.buildFilter(parentObj, firstDocFilter);
                    var secondFilter = this.buildFilter(parentObj, secondDocFilter);
                    if(firstFilter && secondFilter) return self.Filter().and(firstFilter, secondFilter);
                    break;
                case 'or':
                    var firstDocFilter = docFilter.args[0];
                    var secondDocFilter = docFilter.args[1];
                    var firstFilter = this.buildFilter(parentObj, firstDocFilter);
                    var secondFilter = this.buildFilter(parentObj, secondDocFilter);
                    if(firstFilter && secondFilter) return self.Filter().or(firstFilter, secondFilter);
                    if(firstFilter) return firstFilter;
                    if(secondFilter) return secondFilter;
                    break;
                case 'in':
                    var foreignKey = docFilter.args[0];
                    var idArrName = docFilter.args[1];
                    if(idArrName.substr(0,1) == '$'){
                        debugger;
                    }
                    var idArr = parentObj[idArrName];
                    if(!idArr) return;
                    return this.Filter().in(foreignKey, idArr);
                    break;
                case 'isA':
                    return this.Filter(function(obj){
                        if(obj.docType == 'class') return false;
                        var classId = docFilter.args[0];
                        return self.isASync(obj, classId);
                    });
                    break;
                case 'view':
                    var subViewId = docFilter.args[0];
                    var subView = this.cachingStore.getSync(subViewId);
                    if(subView  && subView.filter){
                        var subViewFilter = subView.filter;
                        return this.buildFilter(parentObj, subViewFilter);
                    }
                    break;
                default:
                    break;
            }
        },*/
        updateAllowed: function(doc){
            return true;
            var userId = "575d4c3f2cf3d6dc3ed83148";
            var ownerFilter = this.Filter().contains('owns', [doc._id]);
            var ownerCollection = this.filter(ownerFilter);
            return ownerCollection.fetch().then(function(owners){
                console.log('owner of', doc.name, ownerFilter);
                console.dir(owners);
                if(owners[0]._id == userId) return true;
                return false;
            });
        },
        makeObjectId: function() {
            var timestamp = (new Date().getTime() / 1000 | 0).toString(16);
            return timestamp + 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, function() {
                    return (Math.random() * 16 | 0).toString(16);
                }).toLowerCase();
        },
        enableTransactionButtons: function () {
            registry.byId('cancelButtonId').set('disabled', false);
            registry.byId('saveButtonId').set('disabled', false);
        }
    });
});
