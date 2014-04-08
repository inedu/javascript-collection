(function (window) {
    "use strict";
    var appUrl, hostUrl, queryParams,
        executor, baseUrl, targetStr,
		notAnApp_Flag = 0, 
		say, rest, jsom, 
        spyreqs, spyreqs_version = "0.0.7";

    if (typeof window.console !== 'undefined') {
        say = function (what) { window.console.log(what); };
    } else if ((typeof window.top !== 'undefined') && (typeof window.top.console !== 'undefined')) {
        say = function (what) { window.top.console.log(what); };
    } else if ((typeof window.opener !== 'undefined') && (typeof window.opener.console !== 'undefined')) {
        say = function (what) { window.opener.console.log(what); };
    } else { say = function () { }; }

    function getAsync(url) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "GET",
            dataType: "json",
            headers: {
                Accept: "application/json;odata=verbose"
            },
            success: function(data) {
                defer.resolve(JSON.parse(data.body));
            },
            fail: function(error) {
                defer.reject(error);
            }
        });

        return defer.promise();
    }

    function getFile(url) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url, method: "GET",
            success: function (data) {
                defer.resolve(data.body);
            },
            fail: function (error) { defer.reject(error); }
        });
        return defer.promise();
    }

    function addFile(url, file) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "POST",
            headers: {
                "Accept": "application/json; odata=verbose"
            },
            contentType: "application/json;odata=verbose",
            body: file,
            success: function (data) {
                defer.resolve(JSON.parse(data.body));
            },
            fail: function (error) {
                defer.reject(error);
            }
        });
        return defer.promise();
    }

    function addFolder(url,data){
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "POST",
            headers: {
                "ACCEPT": "application/json;odata=verbose",
                "Content-Type": "application/json;odata=verbose"
            },
            contentType: "application/json;odata=verbose",
            body: JSON.stringify(data),
            success: function (data) {
                defer.resolve(JSON.parse(data.body));
            },
            fail: function (error) {
                defer.reject(error);
            }
        });
        return defer.promise();
    }

    function deleteAsync(url, etag) {
        var defer = new $.Deferred();
        
        executor.executeAsync({
            url: url,
            method: "POST",
            headers: {
                "Accept": "application/json;odata=verbose",
                "X-HTTP-Method": "DELETE",
                "If-Match": etag ? etag : "*"
            },
            success: function (data) {
                //data.body is an empty string
                defer.resolve(data);
            },
            fail: function (error) {
                defer.reject(error);
            }
        });
        return defer.promise();
    }

    function updateAsync(url, data) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Accept": "application/json;odata=verbose",
                "Content-Type": "application/json;odata=verbose",
                "X-HTTP-Method": "MERGE",
                "If-Match": (data.__metadata && data.__metadata.etag) ? data.__metadata.etag : "*"
            },
            success: function (data) {
                //data.body is an empty string
                defer.resolve(data);
            },
            fail: function (error) {
                defer.reject(error);
            }
        });
        return defer.promise();
    }

    function createAsync(url, data) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                Accept: "application/json;odata=verbose",
                "Content-Type": "application/json;odata=verbose"
            },
            success: function (data) {
                defer.resolve(JSON.parse(data.body));
            },
            fail: function (error) {
                defer.reject(error);
            }
        });
        return defer.promise();
    }

    /**
     * checks if the query argument is a string and if it is not returns an empty string
     * @param  {string} query [the query to execute]
     * @return {string}       [the input query or an empty string]
     */
    function checkQuery(query) {
        if (typeof query === 'undefined' || (typeof query !== 'string' && !(query instanceof String))) {
            return '';
        }
        return query;
    }

    function newRemoteContextInstance() {
        // for jsom use. Return an object with new instances for clear async requests
        var returnObj = {}, context, factory, appContextSite;
		if (!SP.ClientContext) {
			say("SP.ClientContext not loaded"); return null;
		}
        context = new SP.ClientContext(appUrl);
        factory = new SP.ProxyWebRequestExecutorFactory(appUrl);
        context.set_webRequestExecutorFactory(factory);
        appContextSite = new SP.AppContextSite(context, hostUrl);

        returnObj.context = context;
        returnObj.factory = factory;
        returnObj.appContextSite = appContextSite;
        return returnObj;
    }
	
	function newLocalContextInstance() {
        // for jsom use. Return an object with new instances for clear async requests        
		var returnObj = {}, context, appContextSite;
		if (!SP.ClientContext) {
			say("SP.ClientContext not loaded"); return null;
		}
        context = new SP.ClientContext(appUrl);    
        returnObj.context = context;
		// nasty hack safelly find the obj
		returnObj.appContextSite = context;
        return returnObj;
    }

    function urlParamsObj() {
        // function returns an object with url parameters
        if (window.location.search) { // if there are params in URL
            var param_array = document.location.search.substring(1).split('&'),
                theLength = param_array.length,
                params = {}, i = 0, x;

            for (; i < theLength; i++) {
                x = param_array[i].toString().split('=');
                params[x[0]] = x[1];
            }
            return params;
        }
        return {};
    }

    function buildQueryString(str, param, val) {
        // function returns string with str parameters plus the given parameter. works even param already exists in str
        var ind = str.indexOf('?');
        if (ind > -1) {
            var param_array = str.substring(ind + 1).split('&');
            var params = {};
            var theLength = param_array.length;
            for (var i = 0; i < theLength; i++) {
                var x = param_array[i].toString().split('=');
                params[x[0]] = x[1];
            }
            params[param] = val;
            var attached = "?";
            for (var key in params) {
                attached += key + "=" + params[key] + "&";
            } attached = attached.substr(0, attached.length - 1);
            return String(str.substr(0, ind) + attached);
        } return String(str + "?" + param + "=" + val);
    }

    queryParams = urlParamsObj();	
    if (typeof queryParams.SPAppWebUrl !== 'undefined') {
		appUrl = decodeURIComponent(queryParams.SPAppWebUrl);
		if (appUrl.indexOf('#') !== -1) { appUrl = appUrl.split('#')[0]; }		
	} else { notAnApp_Flag ++; }
	
    if (typeof queryParams.SPHostUrl !== 'undefined') {
		hostUrl = decodeURIComponent(queryParams.SPHostUrl);
		// for rest use
		targetStr = "&@target='" + hostUrl + "'";
		baseUrl = appUrl + "/_api/SP.AppContextSite(@target)/";
		executor = new SP.RequestExecutor(appUrl); 
	} else { notAnApp_Flag ++; }
	
	if (notAnApp_Flag == 2) {
		// this is not an app, so assing the proper web url to both vars
		// Caution, always use 'App' relative functions when NOT in app
		var url = window.location.href;
		appUrl = hostUrl = url.substring(0,url.indexOf('/Pages'));
		// load SP.RequestExecutor to let REST work on host site api
		$.getScript(hostUrl + "/_layouts/15/SP.RequestExecutor.js")
		.done(function( script, textStatus ) {
			say('loaded: RequestExecutor.js');
			executor = new SP.RequestExecutor(hostUrl); 
		})
		.fail(function( script, textStatus ) {
			say('could not load: RequestExecutor.js');
		});		
		// load sp.js for jsom use if not already loadad
		if (!SP.ClientContext) { 
			SP.SOD.executeFunc('sp.js', 'SP.ClientContext.get_current', 
				function(){ say('loaded: sp.js'); }
			);
		} else { say('sp.js is already loaded') }
	} else if (notAnApp_Flag == 1) { say('query param (SPHostUrl or SPAppWebUrl) is misssing'); }	   


    function mirrorAppFunctions(obj, properties) {
        var keys, newKey;

        properties.forEach(function(prop) {
            keys = Object.keys(obj[prop]);

            keys.forEach(function(key) {
                if (key.indexOf('App') !== -1) {
                    newKey = key.replace('App', 'Web');
                    obj[prop][newKey] = obj[prop][key];
                }
            });
        });

        return obj;
    }

    /**
     * the rest and jsom objects have methods that are not to be exposed 
	 * and are used only from the spyreqs.rest / spyreqs.jsom methods
     */
    rest = {
        createList: function (url, list) {
            var data = {
                "__metadata": {
                    type: "SP.List"
                },
                BaseTemplate: list.Template,
                Title: list.Title
            };
            return createAsync(url, data);
        },
        addListField: function (url, field, fieldType) {
            field.__metadata = {
                type: (typeof fieldType !== 'undefined') ? fieldType : 'SP.Field'
            };
            return createAsync(url, field);
        }
    };
    jsom = {
        createListFields: function (context, SPlist, fieldsObj) {
            var field, defer, result;

            field = fieldsObj.shift();
            createListField();

            function createListField() {
                var xmlStr, choice, attr;

                if (typeof defer === 'undefined') {
                    defer = new $.Deferred();
                }
                if (typeof field.Type === 'undefined') {
                    field.Type = "Text";
                }
                if (typeof field.DisplayName === 'undefined') {
                    field.DisplayName = field.Name;
                }
                if (field.Type !== 'Lookup') {
                    xmlStr = '<Field ';
                    for (attr in field) {
                        if (attr !== 'choices') {
                            xmlStr += attr + '="' + field[attr] + '" ';
                        }
                    }
                    xmlStr += '>';
                    if (field.Type === 'Choice') {
                        xmlStr += '<CHOICES>';
                        for (choice in field.choices) {
                            xmlStr += '<CHOICE>' + field.choices[choice] + '</CHOICE>';
                        }
                        xmlStr += '</CHOICES>';
                    }
                    xmlStr += '</Field>';
                } else {
                    xmlStr += '';
                }
                result = SPlist.get_fields().addFieldAsXml(xmlStr, true, SP.AddFieldOptions.defaultValue);
                context.load(SPlist);
                context.executeQueryAsync(success, fail);
            }

            function success() {
                if (fieldsObj.length > 0) {
                    field = fieldsObj.shift();
                    createListField();
                } else {
                    defer.resolve(result);
                }
            }

            function fail(sender, args) {
                var error = { sender: sender, args: args };
                defer.reject(error);
            }

            return defer.promise();
        },
		createList: function (c, listObj) {				
			var web, theList, listCreationInfo, template, field, defer = new $.Deferred(), val_temp, fn_temp, isValidAttrBool,
				lciAttrs = [
					"url", "description", "documentTemplateType",
					"customSchemaXml", "dataSourceProperties",
					"quickLaunchOption", "templateFeatureId" 			
				], 
				listAttrs = [
					"contentTypesEnabled", "defaultContentApprovalWorkflowId",
					"defaultDisplayFormUrl", "defaultEditFormUrl",
					"defaultNewFormUrl", "documentTemplateUrl",
					"draftVersionVisibility", "enableAttachments",
					"enableFolderCreation",	"enableMinorVersions",
					"enableModeration", "enableVersioning",
					"forceCheckout", "hidden", "isApplicationList",
					"isSiteAssetsLibrary", "multipleDataList",
					"noCrawl", "onQuickLaunch", "validationFormula",
					"validationMessage", "direction"
				];
			
			web = c.appContextSite.get_web();
			listCreationInfo = new SP.ListCreationInformation();			

			if (typeof listObj.title === 'undefined') {
				say('createList cannot create without .title');
				var args = { 
					get_message : function() { return "createList cannot create without .title"; },		
					get_stackTrace : function() { return null; }	
				};				 
				setTimeout( fail(null,args), 500 );
				return defer.promise();	
			}			
			listCreationInfo.set_title(listObj.title);			
			
			if (typeof listObj.template === 'undefined') {
				template = SP.ListTemplateType.genericList;
			} else if (isNaN(listObj.template)) {
				template = SP.ListTemplateType[listObj.template];
			} else {
				template = listObj.template;
			}
			listCreationInfo.set_templateType(template);
			
			// set any other attribute of listCreationInformation from listObject	
			for (var attr in listObj) {
				val_temp = listObj[attr];
				fn_temp = "set_" + attr;
				if (typeof listCreationInfo[fn_temp] == 'function') {
					listCreationInfo[fn_temp](val_temp);
				} 
			}			
			theList = web.get_lists().add(listCreationInfo);	
			
			// set any other attribute of list from listObject	
			for (var attr in listObj) {
				val_temp = listObj[attr];
				fn_temp = "set_" + attr;				 
				if (listAttrs.indexOf(attr)>-1) {
					theList[fn_temp](val_temp);
				}     
			}	
			theList.update();	
			
			c.context.load(theList);
			c.context.executeQueryAsync(success, fail);

			function success() {						
				// add fields
				if (listObj.fields) {
					// start creating fields
					$.when(jsom.createListFields(c.context, theList, listObj.fields)).then(
						function (data) {
							// create List Fields finished
							defer.resolve(listObj);
						},
						function (error) {
							defer.reject(error);
						}
					);
				} else {
					// no fields to create
					defer.resolve(listObj);
				}
			}

			function fail(sender, args) {
				var error = { sender: sender, args: args };
				defer.reject(error);
			}

			return defer.promise();			
		},
		addListItem: function (c, listTitle, itemObj) {
			var web, theList, theListItem, prop, itemCreateInfo, defer = new $.Deferred();
		 
			web = c.appContextSite.get_web();
			theList = web.get_lists().getByTitle(listTitle);
			itemCreateInfo = new SP.ListItemCreationInformation();
			theListItem = theList.addItem(itemCreateInfo);
			for (prop in itemObj) {
				theListItem.set_item(prop, itemObj[prop]);
			}
			theListItem.update();
			c.context.load(theListItem);
			c.context.executeQueryAsync(success, fail);

			function success() {
				defer.resolve(theListItem.get_id());
			}

			function fail(sender, args) {
				var error = { sender: sender, args: args };
				defer.reject(error);
			}

			return defer.promise();
		},
		getItems: function (c, listTitle, query) {
			var web, theList, resultCollection, defer = new $.Deferred();
		
			web = c.appContextSite.get_web(); 
			theList = web.get_lists().getByTitle(listTitle); 
			var camlQuery = new SP.CamlQuery();
			camlQuery.set_viewXml(query); 		
			resultCollection = theList.getItems(camlQuery);  
			c.context.load(resultCollection);  
			c.context.executeQueryAsync(success, fail);

			function success() {
				defer.resolve(resultCollection);
			}

			function fail(sender, args) {
				var error = {
					sender: sender,
					args: args
				};
				defer.reject(error);
			}

			return defer.promise();
		},
		updateListItem: function (c, listTitle, itemObj, itemId) {
			var web, theList, theListItem, prop, itemId, itemCreateInfo, defer = new $.Deferred();
		 
			web = c.appContextSite.get_web();
			theList = web.get_lists().getByTitle(listTitle);			 
			
			theListItem = theList.getItemById(itemId);
			for (prop in itemObj) {
				theListItem.set_item(prop, itemObj[prop]);
			}
			theListItem.update();
			c.context.load(theListItem);
			c.context.executeQueryAsync(success, fail);

			function success() {
				defer.resolve(itemId);
			}

			function fail(sender, args) {
				var error = { sender: sender, args: args };
				defer.reject(error);
			}

			return defer.promise();
		},
		checkList: function (c, listTitle) {
			var web, collectionList, defer = new $.Deferred();
			
			if (!c) {
				// SP.ClientContext not loaded, c is null
				var args = { 
					get_message : function() { return "SP.ClientContext not loaded"; },		
					get_stackTrace : function() { return null; }	
				};				 
				setTimeout( fail(null,args), 500 );
				return defer.promise();				
			}
			
			web = c.appContextSite.get_web();
			collectionList = web.get_lists();
			// this will only load Title, no other list properties
			c.context.load(collectionList, 'Include(Title)');
			c.context.executeQueryAsync(success, fail);

			function success() {
				var listInfo = '',
					answerBool = false,
					listEnumerator = collectionList.getEnumerator();

				while (listEnumerator.moveNext()) {
					var oList = listEnumerator.get_current();
					if (oList.get_title() == listTitle) {
						answerBool = true;
						break;
					}
				}
				say(answerBool);
				defer.resolve(answerBool);
			}

			function fail(sender, args) {
				var error = {
					sender: sender,
					args: args
				};
				defer.reject(error);
			}

			return defer.promise();
		},
		removeRecentElemByTitle: function(c, elemTitle) {
			var ql = c.appContextSite.get_web().get_navigation().get_quickLaunch(), defer = new $.Deferred();	  
			c.context.load(ql);
			c.context.executeQueryAsync(
				function () {
					var objEnumerator = ql.getEnumerator(), navItem;
					while (objEnumerator.moveNext()) {
						navItem = objEnumerator.get_current();		 
						if (navItem.get_title() == "Recent") {
							// found 'Recent' node, get its children
							var ch = navItem.get_children();
							c.context.load(ch);
							c.context.executeQueryAsync(		
								function () {
									var childsEnum = ch.getEnumerator(), childItem, foundBool = false;
									while (childsEnum.moveNext()) {
										childItem = childsEnum.get_current();		 
										if (childItem.get_title() == elemTitle) {
											foundBool = true;
											childItem.deleteObject();
											c.context.load(ql);
											c.context.executeQueryAsync(
												success, 
												fail
											);
											break;									
										}
									}
									if (!foundBool) {
										var args = { 
											get_message : function() { return "Element was not found"; },		
											get_stackTrace : function() { return null; }	
										};
										setTimeout( fail(null,args), 500 );
									}
								}, 
								fail
							);						
						}	 
					} 
				}, 
				fail
			);
			
			function success() {
				var msg = 'element removed from Recent';
				defer.resolve(msg);
			}
			
			function fail(sender, args) {
				var error = {
					sender: sender,
					args: args
				};
				defer.reject(error);
			}
			
			return defer.promise();
		},
		getList: function (c, listTitle) {
			var web, theList, defer = new $.Deferred();			
			 
			web = c.appContextSite.get_web();
			theList = web.get_lists().getByTitle(listTitle);
			c.context.load(theList);
			c.context.executeQueryAsync(success, fail);

			function success() {				 
				defer.resolve(theList);
			}

			function fail(sender, args) {
				var error = {
					sender: sender,
					args: args
				};
				defer.reject(error);
			}

			return defer.promise();
		},
		deleteList: function (c, listTitle) {
			var web, theList, defer = new $.Deferred();			
			 
			web = c.appContextSite.get_web();
			theList = web.get_lists().getByTitle(listTitle);
			theList.deleteObject();
			c.context.executeQueryAsync(success, fail);

			function success() {				 
				defer.resolve(listTitle + " deleted");
			}

			function fail(sender, args) {
				var error = {
					sender: sender,
					args: args
				};
				defer.reject(error);
			}

			return defer.promise();
		},
		getListPermissions: function (c, listTitle, userName) {
			var web, theList, userPerms, defer = new $.Deferred();			
			 
			web = c.appContextSite.get_web();
			theList = web.get_lists().getByTitle(listTitle);
			userPerms = theList.getUserEffectivePermissions(userName);
			c.context.load(theList, 'EffectiveBasePermissions');
			c.context.executeQueryAsync(success, fail);

			function success() {				 
				defer.resolve(userPerms);
			}

			function fail(sender, args) {
				var error = {
					sender: sender,
					args: args
				};
				defer.reject(error);
			}

			return defer.promise();
		}
    };

    spyreqs = {
        rest: {
            /**
             * gets the Lists of the host Site
             * @param  {string} query [the query to execute example:"$filter=..."]
             * example of using the function
             * spyreqs.rest.getHostLists("$select=...").then(function(data){//doSomething with the data},function(error){//handle the error});
             */
            getHostLists: function (query) {
                var url = baseUrl + "web/lists?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            getAppLists: function (query) {
                var url = appUrl + "/_api/web/lists?" + checkQuery(query);
                return getAsync(url);
            },
            /**
             * gets a List from the Host Site by the Title of the List
             * @param  {string} listTitle [the Title of the List]
             * @param  {string} query     [the query to execute]
             */
            getHostListByTitle: function (listTitle, query) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            /**
             * gets the Items of a List from the Host Site
             * @param  {string} listTitle [The Title of the List]
             * @param  {string} query     [the query to execute]
             */
            getAppListByTitle: function (listTitle, query) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')?" + checkQuery(query);
                return getAsync(url);
            },
            getHostListItems: function (listTitle, query) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            getAppListItems: function (listTitle, query) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Items?" + checkQuery(query);
                return getAsync(url);
            },
            /**
             * gets the Fields of a List form the Host Site
             * @param  {string} listTitle [The Title of the List ]
             * @param  {string} query     [the query to execute]
             */
            getHostListFields: function (listTitle, query) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Fields?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            getAppListFields: function (listTitle, query) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Fields?" + checkQuery(query);

                return getAsync(url);
            },
            /**
             * create a List at the Host Site
             * @param  {object} list [the list to create. Must have the properties 'Template' and 'Title']
             */
            createHostList: function (list) {
                var url = baseUrl + "web/lists?" + targetStr;
                return rest.createList(url, list);
            },
            createAppList: function (list) {
                var url = appUrl + "/_api/web/lists?";
                return rest.createList(url, list);
            },
            /**
             * adds an item to a Host List
             * @param {string} listTitle [The Title of the List]
             * @param {object} item      [the item to create. Must have the properties Title and __metadata.
             * __metadata must be an object with property type and value "SP.Data.LessonsListItem"]
             */
            addHostListItem: function (listTitle, item) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items?" + targetStr;
                return createAsync(url, item);
            },
            addAppListItem: function (listTitle, item) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Items?";
                return createAsync(url, item);
            },
            /**
             * deletes an item from List from the Host Site
             * @param  {string} listTitle [The Title of the List]
             * @param  {string} itemId    [the id of the item]
             * @param  {string} etag      [the etag value of the item's __metadata object]
             */
            deleteHostListItem: function (listTitle, itemId, etag) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items(" + itemId + ")?" + targetStr;
                return deleteAsync(url, etag);
            },
            deleteAppListItem: function (listTitle, itemId, etag) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Items(" + itemId + ")?";
                return deleteAsync(url, etag);
            },
            updateHostList:function(list){
                //list must have Title, Id and __metadata with property type 
                var url = baseUrl + "web/lists/getByTitle('" + list.Title + "')?" + targetStr;
                return updateAsync(url, list);
            },
            /**
             * updates an item in a Host List
             * @param  {string} listTitle [the title of the Host List]
             * @param  {object} item      [the item to update. Must have the properties Id and __metadata]       
             * var item = {
             *   "__metadata": {
             *       type: "SP.Data.DemodemoListItem",//prepei na breis gia th lista to sygkekrimeno type
             *       etag:""//optional
             *   },
             *   Id:".."//guid ypoxrewtiko
             *   //ola ta columns pou 8es na allakseis
             *   Title: "item",
             *   NotEditable:"edited"
            * };
             */
            updateHostListItem: function (listTitle, item) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items(" + item.Id + ")?" + targetStr;
                return updateAsync(url, item);
            },
            updateAppListItem: function (listTitle, item) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Items(" + item.Id + ")?";
                return updateAsync(url, item);
            },
            /* updateHostListField field object example
            *    var field = {
		    *        ReadOnly:false,
		    *        // more properties here
		    *        Id:"...", // this is the fields guid, requiered
		    *        __metadata:{
			*            type:"SP.Field" // requiered
			*            // may add etag 
		    *        }
	        *   };
            */
            updateHostListField: function (listTitle, field) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Fields(guid'" + field.Id + "')?" + targetStr;
                return updateAsync(url, field);
            },
            updateAppListField: function (listTitle, field) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Fields(guid'" + field.Id + "')?";
                return updateAsync(url, field);
            },
            /**
             * adds a field to a Host List
             * @param {string} listGuid [the guid of the list]
             * @param {object} field    [the field to add]
             * @param {string} fieldType [otional fieldType.If not provided defaults to SP.Field]
             * field must have the properties :
             *      'Title': 'field title',
             *      'FieldTypeKind': FieldType value,{int}
             *      'Required': true/false,
             *      'EnforceUniqueValues': true/false,
             *      'StaticName': 'field name'
             * information about FieldTypeKind :
             *     http://msdn.microsoft.com/en-us/library/microsoft.sharepoint.client.fieldtype.aspx
             */
            addHostListField: function (listGuid, field, fieldType) {
                var url = baseUrl + "web/lists(guid'" + listGuid + "')/Fields?" + targetStr;
                return rest.addListField(url, field, fieldType);
            },
            addAppListField: function (listGuid, field, fieldType) {
                var url = appUrl + "/_api/web/lists(guid'" + listGuid + "')/Fields?";
                return rest.addListField(url, field, fieldType);
            },
            getCurrentUser: function () {
                var url = baseUrl + "/web/CurrentUser?" + targetStr;
                return getAsync(url);
            },
            getHostFile: function (fileUrl) {
                var url = baseUrl + "web/GetFileByServerRelativeUrl('" + fileUrl + "')/$value?" + targetStr;
                return getFile(url);
            },
            getAppFile: function (fileUrl) {
                var url = appUrl + "/_api/web/GetFileByServerRelativeUrl('" + fileUrl + "')/$value?";
                return getFile(url);
            },
            getHostFolderFiles:function(folderName){
                var url = baseUrl + "web/GetFolderByServerRelativeUrl('" + folderName + "')/Files?" + targetStr;
                return getAsync(url);
            },
            getHostFolderFolders:function(folderName){
                var url = baseUrl + "web/GetFolderByServerRelativeUrl('" + folderName + "')/Folders?" + targetStr;
                return getAsync(url);
            },
            /**
             * creates a Folder To a Host Document Librry
             * @param {string} documentLibrary [the Name of the Document Library to which the Folder should be added]
             * @param {string} folderName      [the Name of the Folder]
             */
            addHostFolder:function(documentLibrary,folderName){
                var url = baseUrl + "web/folders?" + targetStr,
                    folderName = documentLibrary + "/" + folderName,
                    data = {
                        '__metadata': {
                            'type': 'SP.Folder'
                        },
                        'ServerRelativeUrl': folderName
                    };

                return addFolder(url, data);
            },
            addHostFile: function (folderName, fileName, file) {
                var url = baseUrl + "web/GetFolderByServerRelativeUrl('" + folderName + "')/Files/Add(url='" + fileName + "',overwrite=true)?" + targetStr;
                return addFile(url, file);
            },
            addAppFile: function (folderName, fileName, file) {
                var url = appUrl + "/_api/web/GetFolderByServerRelativeUrl('" + folderName + "')/Files/Add(url='" + fileName + "',overwrite=true)?";
                return addFile(url, file);
            },
            getHostListItemAttachments:function(listTitle,itemId){
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items("+itemId+")/AttachmentFiles?" + targetStr;
                return getAsync(url);
            },
            addHostListItemAttachment:function(listTitle,itemId,fileName,file){
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items("+itemId+")/AttachmentFiles/add(FileName='"+fileName+"')?" + targetStr;
                return createAsync(url,file);  
            },
            /**
             * gets the Users of the Site
             * @param  {string} query [the query to execute e.g. "$filter=Email ne ''"] 
             * @return {[type]}       [description]
             */
            getSiteUsers:function(query){
                var url = baseUrl + "web/SiteUsers?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            breakRoleInheritanceOfHostList:function(listTitle){
                var defer = new $.Deferred(),
                    url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/breakroleinheritance(true)?" + targetStr;
                
                executor.executeAsync({
                    url: url,
                    method: 'POST',
                    headers: {
                        Accept: "application/json;odata=verbose"
                    },
                    success: defer.resolve,
                    error: defer.reject
                });

                return defer.promise();
            },
            breakRoleInheritanceOfAppList:function(listTitle){
                var defer = new $.Deferred(),
                    url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/breakroleinheritance(true)?";
                
                executor.executeAsync({
                    url: url,
                    method: 'POST',
                    headers: {
                        Accept: "application/json;odata=verbose"
                    },
                    success: defer.resolve,
                    error: defer.reject
                });

                return defer.promise();
            },            
            givePermissionToGroupToAppList: function(listTitle, permissionName, groupName) {
                var groupId;

                return this.breakRoleInheritanceOfAppList(listTitle)
                    .then(function() {
                        //get the Id of the Group
                        var url = appUrl + "/_api/web/sitegroups/getByName('" + groupName + "')?$select=Id";
                        return getAsync(url);
                    })
                    .then(function(groupData) {
                        //delete roleassignments for this group  
                        var url;
                        groupId = groupData.d.Id;
                        url = appUrl + "/_api/web/lists/getbytitle('" + listTitle + "')/roleassignments/getbyprincipalid('" + groupId + "')";
                        return deleteAsync(url);                        
                    })
                    .then(function() {
                        //get the id of the new roleAssignment
                        var url = appUrl + "/_api/web/roledefinitions/getByName('" + permissionName + "')?select=Id";
                        return getAsync(url);
                    })
                    .done(function(permissionData) {
                        //give to the group in the List Scope the new roleAssignment
                        var url = appUrl + "/_api/web/lists/getbytitle('" + listTitle + "')/roleassignments/" +
                            "addroleassignment(principalid=" + groupId + ",roledefid=" + permissionData.d.Id + ")",
                            defer = new $.Deferred();

                        executor.executeAsync({
                            url: url,
                            method: 'POST',
                            headers: {
                                Accept: "application/json;odata=verbose"
                            },
                            success: defer.resolve,
                            error: defer.reject
                        });

                        return defer.promise();
                    });
            },
            getHostListRoleAssigmnent:function(listTitle,userId){
                var url = baseUrl + "web/lists/getbytitle('" + listTitle + "')/roleassignments/getbyprincipalid('" + userId + "')?"+targetStr;
                return getAsync(url);
            }
        },
        jsom: {
            checkHostList: function (listTitle) {
                // This function checks if list.Title exists.
                /* syntax example: 
                spyreqs.jsom.checkHostList( "listTitle" ).then(
                    function(listExistsBool) { alert(listExistsBool); // true or false },
                    function(error) { alert('checkHostList request failed. ' +  error.args.get_message() + '\n' + error.args.get_stackTrace() ); }
                );  
                */
				var c = newRemoteContextInstance();
				// if SP.ClientContext is not loaded, c will be null. 
				// But, send the promise and let disolve there
				return jsom.checkList(c, listTitle);				
            },
			checkAppList: function (listTitle) { 
                /* syntax example: see checkHostList */
				var c = newLocalContextInstance();
				// if SP.ClientContext is not loaded, c will be null. 
				// But, send the promise and let disolve there
				return jsom.checkList(c, listTitle);
            },
			getHostList: function (listTitle) {
				var c = newRemoteContextInstance();
				return jsom.getList(c, listTitle);    
			},
			getAppList: function (listTitle) {
				var c = newLocalContextInstance();
				return jsom.getList(c, listTitle);    
			},
			deleteHostList: function (listTitle) {
				var c = newRemoteContextInstance();
				return jsom.deleteList(c, listTitle);    
			},
			deleteAppList: function (listTitle) {
				var c = newLocalContextInstance();
				return jsom.deleteList(c, listTitle);    
			},
			getAppListPermissions: function (listTitle, userName) {
				var c = newLocalContextInstance();
				return jsom.getListPermissions(c, listTitle, userName);    
			},
            getHostListItems: function (listTitle, query) {
                /* Example syntax:								
				spyreqs.jsom.getHostListItems("myClasses","<View><Query><Where><IsNotNull><FieldRef Name='ClassGuid'/></IsNotNull></Where></Query></View>").then(
					function(resultCollection) { 
						var listItemEnumerator = resultCollection.getEnumerator(), out=" ";
						while (listItemEnumerator.moveNext()) {
							var oListItem = listItemEnumerator.get_current();
							out += oListItem.get_item('ClassStudentGroupID');
						}	
						alert(out);
					},
					function(error) { alert('getAppListItems request failed. ' +  error.args.get_message() + '\n' + error.args.get_stackTrace() ); }
				 ); 
				*/        
                var c = newRemoteContextInstance();
				return jsom.getItems(c, listTitle, query);               
            },
			getAppListItems: function (listTitle, query) { 
				/* Example syntax: see spyreqs.jsom.getHostListItems	 */		
                var c = newLocalContextInstance();
				return jsom.getItems(c, listTitle, query);               
            },
            addHostListItem: function (listTitle, itemObj) {
                /* example: 
                spyreqs.jsom.addHostListItem("My List", {"Title":"my item", "Score":90}).then(
                    function(itemId) { alert("item was added, id:"+itemId); },
                    function(error) { alert('addHostListItem request failed. ' +  error.args.get_message() + '\n' + error.args.get_stackTrace() ); }
                );  
                */              
                var c = newRemoteContextInstance();
				return jsom.addListItem(c, listTitle, itemObj);
            },
			addAppListItem: function (listTitle, itemObj) {
				/* example: see addHostListItem example */
				var c = newLocalContextInstance();
				return jsom.addListItem(c, listTitle, itemObj);
			},
			updateAppListItem: function (listTitle, itemObj, itemId) {
                /* example: 
                spyreqs.jsom.updateAppListItem("My List", {"Title":"my item", "Score":90}, 9).then(
                    function(itemId) { alert("item was added, id:"+itemId); },
                    function(error) { alert('addHostListItem request failed. ' +  error.args.get_message() + '\n' + error.args.get_stackTrace() ); }
                );  
                */              
                var c = newLocalContextInstance();
				return jsom.updateListItem(c, listTitle, itemObj, itemId);
            },
			updateHostListItem: function (listTitle, itemObj, itemId) {
                /* syntax example: see updateAppListItem example */            
                var c = newRemoteContextInstance();
				return jsom.updateListItem(c, listTitle, itemObj, itemId);
            },
			removeHostRecentElemByTitle: function(elemTitle) {
				// removes element from Host site Recent node, under QuickLaunch node. 
				var c = newRemoteContextInstance();				
				return jsom.removeRecentElemByTitle(c, elemTitle);
			},	
			removeAppRecentElemByTitle: function(elemTitle) {
				// removes element from Host site Recent node, under QuickLaunch node. 
				var c = newLocalContextInstance();				
				return jsom.removeRecentElemByTitle(c, elemTitle);
			},				
            createHostList: function (listObj) {
                /* please put all list attributes and listInformation attributes in listObj. 
					syntax example:
					spyreqs.jsom.createHostList({
						"title":app_MainListName,	 
						"url":app_MainListName, 
						"onQuickLaunch" : true,
						"hidden" : true,
						"description" : "this is a list", 
							fields : [	 
								{"Name":"userId", "Type":"Text", "Required":"true"},
								{"Name":"scoreFinal", "Type":"Number", "hidden":"true"},
								{"Name":"assginedTo", "Type":"User"},
								{"Name":"state", "Type":"Choice", "choices" : ["rejected", "approved", "passed", "proggress"]},
								{"Name":"comments", "Type":"Note"}
							]	 
						})
					.then( ...... )				
					field properties: http://msdn.microsoft.com/en-us/library/office/jj246815.aspx
				*/
				var c = newRemoteContextInstance();
				return jsom.createList(c, listObj);               
            },
			createAppList: function (listObj) {
                /* syntax example: see createHostList example */					
				var c = newLocalContextInstance();
				return jsom.createList(c, listObj);               
            },
            createHostSite: function (webToCreate) {
                // NOT READY
                var web, webCreationInfo, newWeb;

                web = appContextSite.get_web();
                webCreationInfo = new SP.WebCreationInformation();
                webCreationInfo.set_title(webToCreate.Title);
                webCreationInfo.set_webTemplate(webToCreate.Template);
                webCreationInfo.set_url(webToCreate.Url);
                webCreationInfo.set_language(webToCreate.language);
                webCreationInfo.set_useSamePermissionsAsParentSite(webToCreate.inheritPerms);
                newWeb = web.get_webs().add(webCreationInfo);

                context.load(newWeb);
                context.executeQueryAsync(success, fail);

                function success() {
                    var result = newWeb.get_title() + ' created.';
                    alert(result);
                }

                function fail(sender, args) {
                    alert('Request failed. ' + args.get_message() +
                        '\n' + args.get_stackTrace());
                }
            }
        },
        utils: {
            urlParamsObj: urlParamsObj,
            buildQueryString : buildQueryString,
            say: say,
			/**
             * gets the Site's Regional Settings like DateFormat,DateSeparator,LocaleId...
             * @param  {string} query [optional query]
			 * example: getRegionalSettings("$select=DateSeperator,LocaleId");			 
             */
            getRegionalSettings: function(query) {
                var url = baseUrl + "/web/RegionalSettings?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            getAppUrl:function(){
                return appUrl;
            },
            getHostUrl:function(){
                return hostUrl;
            }
        },
		version : function () { say ("Hello, spyreqs ver " + spyreqs_version); }
    };

    // liberate scope...
    window.spyreqs = mirrorAppFunctions(spyreqs,['rest','jsom','utils']);
}(window));
