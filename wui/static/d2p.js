d2p = {

_simulateOutage: false,
_getLocalHost: function() {
    var urlbase = window.location.protocol + '//' + window.location.host;
    return {urlbase: urlbase, name: d2p.i18n('This server'), disabled: d2p._simulateOutage}
},
_onAppcacheUpdateReady: function() {
    window.location.reload();
},
checkBrowser: function() {
    if (typeof JSON == 'undefined') {
        alert("This browser does not support JSON");
    }
    if (typeof WebSocket == 'undefined') {
        alert("This browser does not support websockets");
    }
    if (typeof window.localStorage == 'undefined') {
        alert("This browser does not support local storage");
    }
    if (typeof window.applicationCache == 'undefined') {
        alert("This browser does not support offline Web Applications");
    }
},
i18n: function(s) {
    return s;
},
enterOfflineMode: function() {
    var _showTodo = $('<div style="position: static; width: 1000px; margin: 0 auto; top: 45%; font-size: 120%;"></div>');
    _showTodo.text('offline mode. Not yet implemented (@timvancleef)');
    $('body').append(_showTodo);
},
switchToHost: function(host, reason) {
    var url = host.urlbase + window.location.pathname + '?from=fallback_' + reason;
    window.location.href = url;
},

/* onSuccess and onError are optional */
sendQuery: function(path, data, onSuccess, onError) {
    onError = onError || function() {alert(d2p.i18n('Query to ' + path + ' failed'));};
    $.ajax(path, {
        data:data,
        dataType: 'json',
        success: function(data) {
            if (onSuccess) {
                onSuccess(data);
            }
        },
        type: 'POST',
        error: onError
    });
},

usersettings_init: function() {
    d2p.usersettings = {
        autoSwitch: false,
        timeout: 1000,
        pingInterval: 2000
    };
},
usersettings_load: function() {
    var settingsStr = window.localStorage.getItem('d2p_usersettings');
    if (settingsStr) {
        d2p.usersettings = JSON.parse(settingsStr);
    }
},
usersettings_save: function() {
    var settingsStr = JSON.stringify(d2p.usersettings);
    window.localStorage.setItem('d2p_usersettings', settingsStr);
},


/**
onError(host, stateString)
onReady(host, sendMessageFunc, sock). sendMessagFunc is a function()
*/
_setupMessageSock: function(host, endpoint, onError, onReady) {
    if (host.disabled) {
        onError(host, 'disabled');
        return;
    }

    var ws;
    var mid = 0;
    var outstanding = {};
    var sendMessageFunc = function(msg, onError, onAnswer) {
        var timeout = setTimeout(function() {
            if (mid in outstanding) {
                delete outstanding[msg.rmid];
            }
            onError();
        }, d2p.usersettings.timeout);

        outstanding[mid] = {onAnswer: onAnswer, timeout: timeout};
        msg.mid = mid;
        var msgStr = JSON.stringify(msg);
        ws.send(msgStr);

        mid++;
    };

    var connectTimeout = setTimeout(function() {
        // Socket hasn't been created in time, destroy it now
        connectTimeout = false;
        ws.onopen = function() {};
        ws.onmessage = function() {};
        ws.onclose = function() {};
        ws = false;
        onError(host, 'offline');
    }, d2p.usersettings.timeout);

    var wsUrl = host.urlbase.replace(/^http(s?):\/\//, 'ws$1://') + endpoint;
    ws = new WebSocket(wsUrl);
    ws.onopen = function() {
        clearTimeout(connectTimeout);
        onReady(host, sendMessageFunc, ws);
    };
    ws.onmessage = function(messageEvent) {
        var msg = JSON.parse(messageEvent.data);
        if (msg.rmid in outstanding) {
            var msgo = outstanding[msg.rmid];
            clearTimeout(msgo.timeout);
            msgo.onAnswer(msg);
            delete outstanding[msg.rmid];
        } else {
            console.log('Spurious message with id ' + msg.rmid);
        }
    };
    var onErrorImpl = function() {
        onError(host, 'offline');
    };
    ws.onerror = onErrorImpl;
    ws.onclose = onErrorImpl;

    return {cancel: function() {if (ws) {ws.close();}}};
},

/**
* @param onResult function(host, stateString)
*/
ping: function(host, onResult) {
    var msgSockHandle = d2p._setupMessageSock(host, '/wsping', onResult,
        function(host, sendMessageFunc, sock) {
            var destroySock = function() {
                sock.onclose = function() {};
                sock.close();
            };
            var onAnswer = function(answer) {
                if (answer.mtype == 'pong') {
                    onResult(host, 'online');
                } else {
                    onResult(host, 'offline');
                }
                destroySock();
            };
            var onError = function() {
                destroySock();
                onResult(host, 'offline');
            };
           
           sendMessageFunc({mtype: 'ping'}, onError, onAnswer);
    });
    return msgSockHandle;
},

onHostFail: function() {
    var curHost = d2p._getLocalHost();
    var hosts = d2p.config.fallbacks;
    var reportingHosts = {};

    var autoSwitch = function() {
        if (d2p.usersettings.autoSwitch) {
            var allOnlineHosts = _.filter(hosts, function(h) {
                return reportingHosts[h.urlbase] == 'online';
            });

            if (allOnlineHosts.length > 0) {
                d2p.switchToHost(allOnlineHosts[0], 'auto');
            }
        }
    };

    var paui = d2p._ui_createPingAllUI(hosts,
        function() {
            _.each(pingHandles, function (ph) {
                if (ph) ph.cancel();
            });
            d2p.enterOfflineMode();
        },
        d2p.i18n('Server not reachable. Switch to an alternative?'),
        function(contentWrapper) {
            d2p._ui_usersettings_makeSetting('autoSwitch',
                d2p.i18n('Switch to first available fallback server without confirmation'),
                {type: 'checkbox'},
                contentWrapper,
                function(id, newValue) {
                    autoSwitch();
                }
            );
        }
    );

    var pingHandles = _.map(hosts, function(host) {
        return d2p.ping(host, function(host, stateString) {
            paui.enterResult(host, stateString);
            reportingHosts[host.urlbase] = stateString;
            autoSwitch();
        });
    });
},
_autoPing: function() {
    d2p.ping(d2p._getLocalHost(), function(host, stateString) {
        d2p._autopingHandle = false;
        if (stateString == 'online') {
            d2p._autopingHandle = setTimeout(d2p._autoPing, d2p.usersettings.pingInterval);
            return;
        }

        d2p.onHostFail();
    });
},

/**
* Sets up the background ping process for the current host.
*/
setupAutoPing: function() {
    d2p._autoPing();
},
disableAutoPing: function() {
    if (d2p._autopingHandle) {
        clearTimeout(d2p._autopingHandle);
        delete d2p._autopingHandle;
    }
},


_ui_getFormValues: function(form) {
    var res = {};
    form.find(':input').each(function(i, input) {
        var $input = $(input);
        var key = $input.attr('name');
        if (!key) return;
        var val = $input.val();
        res[key] = val;
    });
    return res;
},
/*
onAbort is optional
*/
_ui_makeCenterDialog: function(content, title, onAbort) {
    var wrapper;
    var dialog = d2p._ui_makeDialog(content, title, function() {
        wrapper.remove();
        if (onAbort) {
            onAbort();
        }
    });
    wrapper = $('<div class="dialog_center_wrapper">');
    wrapper.append(dialog);
    $('body').append(wrapper);
    $(dialog.find(':input')[0]).focus();
    return wrapper;
},

/**
@returns The dialog wrapper
*/
_ui_makeDialog: function(content, title, onAbort) {
    var wrapper = $('<div class="dialog"></div>');
    var titleEl = $('<div class="dialog_title"></div>');
    titleEl.text(title);
    var closeEl = $('<div class="dialog_close">x</div>');
    if (onAbort) {
        closeEl.click(onAbort);
    }

    var contentEl = $('<div class="dialog_content"></div>');
    contentEl.append(content);

    wrapper.append(closeEl);
    wrapper.append(titleEl);
    wrapper.append(contentEl);

    return wrapper;
},
/**
onClose will be called when the panel is closed.
addContent will be called with a content wrapper element to add aditional content.
Returns a dictionary with {
    enterResult: function(host, stateString)
    dismiss: function() that destroys the UI
}.
*/
_ui_createPingAllUI: function(hosts, onClose, dlgTitle, addContent) {
    $('#pingResultPanel').remove();
    var dismiss = function() {
        onClose();
        $('#pingResultPanel').remove();
    };
    var panel = $('<div id="pingResultPanel"></div>');

    var pr = $('<ul class="pingResults"></ul>')
    var _hostFields = {};
    _.each(hosts, function(host) {
        var li = $('<li></li>');
        li.attr({'data-host': host.urlbase, title: host.urlbase, 'data-state': 'loading'});
        li.text(host.name);
        li.appendTo(pr);
        _hostFields[host.urlbase] = li;
        li.click(function() {
            if (li.attr('data-state') == 'online') {
                d2p.switchToHost(host, 'manual');
            }
        });
    });
    if (addContent) addContent(pr);
    panel.append(d2p._ui_makeDialog(pr, dlgTitle, dismiss));

    $('body').append(panel);

    var enterResult = function(host, stateString) {
        _hostFields[host.urlbase].attr({'data-state': stateString});
    };

    return {
        dismiss: dismiss,
        enterResult: enterResult,
        hosts:hosts
    };
},
ui_pingAll: function() {
    var hosts = _.flatten([[d2p._getLocalHost()], d2p.config.fallbacks]);
    var paui = d2p._ui_createPingAllUI(hosts, function() {
        _.each(pingHandles, function (ph) {
            if (ph) ph.cancel();
        });
    }, d2p.i18n('Ping all fallbacks'));

    var pingHandles = _.map(hosts, function(host) {
        return d2p.ping(host, paui.enterResult);
    });
},
ui_toggleControlPanel: function() {
    if ($('#controlPanel').length > 0) {
        $('#controlPanel').remove();
        return;
    }

    var controlPanel = $('<div id="controlPanel">');
    var button;

    button = $('<div class="commandbutton button_pingall"></div>');
    button.text(d2p.i18n('Ping all'));
    button.click(d2p.ui_pingAll);
    controlPanel.append(button);

    button = $('<div class="commandbutton button_settings"></div>');
    button.text(d2p.i18n('Settings'));
    button.click(d2p.ui_usersettings_show);
    controlPanel.append(button);

    button = $('<div class="commandbutton button_outage"></div>');
    button.text(d2p.i18n('Outage'));
    button.click(function() {
        d2p._simulateOutage = true;
    });
    controlPanel.append(button);

    button = $('<div class="commandbutton button_dtn"></div>');
    button.text(d2p.i18n('DTN'));
    button.click(function() {
        d2p.content_goto('/_transports/dtn/');
    });
    controlPanel.append(button);

    button = $('<div class="commandbutton button_p2p"></div>');
    button.text(d2p.i18n('P2P'));
    button.click(function() {
        d2p.content_goto('/_transports/p2p/');
    });
    controlPanel.append(button);

    button = $('<div class="commandbutton button_projectlist"></div>');
    button.text(d2p.i18n('Projects'));
    button.click(function() {
        d2p.content_goto('/p/');
    });
    controlPanel.append(button);

    $('#actions').append(controlPanel);
},
ui_init: function() {
    var togglePanelButton = $('<div class="commandbutton button_actions"></div>');
    togglePanelButton.text(d2p.i18n('Actions'));
    togglePanelButton.click(d2p.ui_toggleControlPanel);
    $('#actions').append(togglePanelButton);

    togglePanelButton.click();
},
_ui_uniqId: 0,
/*
onChange gets called if the value is changed; its arguments are the id and new value. It is optional.
*/
_ui_makeSetting: function(id, label, attrs, container, onChange) {
    var type = attrs.type;
    var wrapper = $('<div class="settingsField">');

    var inputId = 'settings_' + id + d2p._ui_uniqId;
    d2p._ui_uniqId++;

    var input;
    switch (type) {
    case 'select':
        input = $('<select>');
        break;
    case 'textarea':
        input = $('<textarea>');
        break;
    default:
        input = $('<input>');
    }
    input.attr({'type': type, 'id': inputId, 'name': id, 'data-settings-id': id});
    if (attrs) input.attr(attrs);
    if (type == 'checkbox') {
        if (d2p.usersettings[id]) input.attr('checked', 'checked');
    } else {
        input.attr({value: d2p.usersettings[id]});
    }
    input.bind('change', function() {
        var value = input.attr('type') == 'checkbox' ? input.is(':checked') : input.val();
        var id = input.attr('data-settings-id');
        if (onChange) {
            onChange(id, value);
        }
    });

    var display = false;
    if (type == 'range') {
        display = $('<span class="rangedisplay"></span>');
        var updateDisplay = function() {
            display.text(input.val() + ' ' + attrs['data-unit']);
        };
        input.bind('change', updateDisplay);
        updateDisplay();
    } else if (type == 'select') {
        _.each(attrs['_options'], function(descr, id) {
            var option = $('<option>');
            option.attr({value: id});
            option.text(descr);
            input.append(option);
        });
    }

    var lbl = $('<label></label>');
    lbl.attr({'for': inputId});
    lbl.text(label);

    var lblType = attrs['data-_lbltype'] ? attrs['data-_lbltype'] : 'after';
    lbl.attr('class', 'settings_label_' + lblType);
    if (lblType == 'bold' || lblType == 'boldnl') {
        lbl.appendTo(wrapper);
        input.appendTo(wrapper);
        if (display) display.appendTo(wrapper);
    } else {
        input.appendTo(wrapper);
        if (display) display.appendTo(wrapper);
        lbl.appendTo(wrapper);
    }

    container.append(wrapper);
},
_ui_usersettings_makeSetting: function(id, label, attrs, container, onChange) {
    d2p._ui_makeSetting(id, label, attrs, container, function(id, value) {
        d2p.usersettings[id] = value;
        d2p.usersettings_save();
        if (onChange) {
            onChange(id, value);
        }
    });
},
ui_usersettings_show: function() {
    $('#usersettings_dlg').remove();
    var settingsEl = $('<div id="usersettings">');
    var makeSetting = function(id, label, attrs) {
        d2p._ui_usersettings_makeSetting(id, label, attrs, settingsEl);
    };

    makeSetting('autoSwitch',
                d2p.i18n('Switch to first available fallback server without confirmation'),
                {type: 'checkbox'});
    makeSetting('timeout',
                d2p.i18n('Server timeout'),
                {type: 'range', min: 500, max: 10000, step: 500, 'data-unit': 'ms'});
    makeSetting('pingInterval',
                d2p.i18n('Automatic ping interval'),
                {type: 'range', min: 500, max: 30000, step: 500, 'data-unit': 'ms'});


    var dlg = d2p._ui_makeCenterDialog(settingsEl, d2p.i18n('Settings'));
    dlg.attr({id: 'usersettings_dlg'});
},
ui_showSwitchNote: function() {
    var text;
    if (window.location.search == '?from=fallback_manual') {
        text = d2p.i18n('You switched to this server.');
    } else if (window.location.search == '?from=fallback_auto') {
        text = d2p.i18n('You were automatically switched to this server.');
    } else {
        return;
    }

    var sn = $('<div id="switchNote">');
    sn.text(d2p.i18n(text));

    var dlg = d2p._ui_makeDialog(sn, d2p.i18n('Welcome!'), function() {
        dlg.remove();
    });
    dlg.attr({id: 'switchNote_dialog'});
    $('body').append(dlg);

    setTimeout(function() {
        dlg.animate({bottom: -120}, 1500, 'swing', function() {
            dlg.remove();
        });
    }, 8000);
},

content_show: function() {
    var vpath = window.location.hash.substring(1);
    $.ajax(vpath, {
        dataType: 'json',
        success: function(data) {
            $('#content').html(data.contenthtml);
            var titleH1 = $('body>header>h1');
            titleH1.text(data.title + ' - ' + titleH1.attr('data-title'));
            document.title = data.title;
        }
    });
},
content_curUrl: function() {
    if (window.location.hash) {
        return window.location.hash.substring(1);
    }
    return '/';
},
content_goto: function(vpath) {
    var hvpath = '#' + vpath;
    if (window.location.hash != hvpath) {
        window.location.hash = hvpath;
    } else {
        d2p.content_show();
    }
},
content_init: function() {
    if (! window.location.hash) {
        window.location.hash = '#/p/';
    }
    d2p.content_show(window.location.hash);
    $(window).bind('hashchange', d2p.content_show);
}

};

window.applicationCache.addEventListener('updateready', d2p._onAppcacheUpdateReady);

$(function() {
d2p.checkBrowser();
d2p.config = JSON.parse($('body').attr('data-configJSON'));
d2p.usersettings_init();
d2p.usersettings_load();
d2p.ui_init();
d2p.ui_showSwitchNote();
d2p.content_init();

d2p.setupAutoPing();
});