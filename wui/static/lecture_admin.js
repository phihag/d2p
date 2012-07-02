"use strict";

// TODO capture hashchange for slide
// TODO shortcuts, ? should bring up a help screen

var lecture = {};
$(function() {
var dataEl = $('#lecture_container');

var _assert = function(b, s, badValues) {
    if (!b) {
        var msg = "Assertion failed" + (s ? ": " + s : "");
        if (badValues) {
            msg += " Got " + badValues.join(", ") + ".";
        }
        throw new Error(msg);
    }
};

var _render = function(templateName, context) {
    var template = lecture.templates[templateName];
    return Mustache.render(template, context, lecture.templates);
};

// Utility function to select the whole content of an element
var _setSelection = function(element, onlyAtStart) {
    var sel = window.getSelection();
    sel.removeAllRanges();
    var range = document.createRange();
    if (onlyAtStart) {
        range.setStart(element, 0);
        range.setEnd(element, 0);
        $(element).focus();
    } else {
        range.selectNodeContents(element);
    }
    sel.addRange(range);
};

var _caretIsOnTop = function(element) {
    var sel = window.getSelection();
    var r = sel.getRangeAt(0);
    if (!r) return false;
    if (!r.collapsed) return false;

    var firstChildren = new Array();
    var c = element;
    while (c) {
        firstChildren.push(c);
        c = c.firstChild;
    }

    var matched = null;
    for (var j = 0;j < firstChildren.length;j++) {
        if (firstChildren[j] == r.endContainer) {
            if (firstChildren[j].nodeType != Node.TEXT_NODE) {
                return true;
            }

            // Match in the first line?
            var marker = document.createElement('span');
            r.insertNode(marker);
            var parent = marker.parentElement;
            var firstCharMarker = document.createElement('span');
            parent.insertBefore(firstCharMarker, parent.firstChild);

            var firstCharY = $(firstCharMarker).offset().top;
            var caretY = $(marker).offset().top;

            var before = marker.previousSibling;
            var after = marker.nextSibling;
            // Join splitted text nodes
            if (before && after && (before.nodeType == Node.TEXT_NODE) && (after.nodeType == Node.TEXT_NODE)) {
                var offsetc = r.startOffset;
                before.nodeValue += after.nodeValue;
                parent.removeChild(after);

                // Restore caret position
                sel.removeAllRanges();
                var newRange = document.createRange();
                newRange.setStart(before, offsetc);
                newRange.setEnd(before, offsetc);
                sel.addRange(newRange);
            }
            parent.removeChild(firstCharMarker);
            parent.removeChild(marker);

            return firstCharY == caretY;
        }
    }
    
    return false;
};


lecture.i18n = function(s) {
    return s;
};

/* Go into presentation mode. */
lecture.present = function(initialSlideNum) {
    var slideNumFromHash = function(defVal) {
        if (typeof defVal === 'undefined') {
            defVal = null;
        }
        var m = window.location.hash.match(/^#s([0-9]+)$/);
        if (m) {
            return parseInt(m[1]);
        } else {
            return defVal;
        }
    };
    if (typeof initialSlideNum === 'undefined') {
        initialSlideNum = slideNumFromHash(0);
    }
    $('.lecture_slide').addClass('lecture_slide_inactive');
    lecture.goToSlide(initialSlideNum);
    $(window).bind('hashchange', function() {
        var num = slideNumFromHash();
        if (num !== null) {
            lecture.goToSlide(num);
        }
    });
    $(document).bind('keydown', lecture._onKeyDown);
    $(window).bind('resize', lecture._scale);
};

lecture.hintStatus = function(msg) {
    var $container = $('#lecture_statusContainer');
    if ($container.length == 0) {
        $container = $('<div id="lecture_statusContainer"></div>');
        dataEl.append($container);
    }

    var $field = $('<div></div>');
    $field.text(msg);
    $field.appendTo($container);
    window.setTimeout(function() {
        var FADE_LENGTH = 1000;
        $field.fadeOut(FADE_LENGTH, function() {
            $field.remove();
        });
        $field.next().animate({'border-top-left-radius': 10}, FADE_LENGTH);
    }, 1500);
};

lecture.keyHooks = {};

lecture._onKeyDown = function(ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return; // Don't impede browser functionality

    if (lecture.keyHooks[ev.keyCode]) {
        lecture.keyHooks[ev.keyCode](ev);
    } else {
        switch (ev.keyCode) {
        case 40: // Down
        case 39: // Right
        case 32: // Space
        case 34: // Pg Down
            lecture.moveSlides(1);
            break;
        case 38: // Up
        case 37: // Left
        case 33: // Pg Up
            lecture.moveSlides(-1);
            break;
        case 36: // Home
            lecture.goToSlide(0);
            break;
        case 35: // End
            lecture.goToSlide(Number.POSITIVE_INFINITY);
            break;
        default:
            return; // Ignore unregistered keys
        };
    }
    ev.preventDefault();
};

lecture.moveSlides = function(incr) {
    lecture.goToSlide(lecture._currentSlideIdx() + incr);
};

lecture._currentSlideIdx = function() {
    return $('.lecture_slide_active').index('.lecture_slide');
};

lecture._slideCount = function() {
    return $('.lecture_slide').length;
};

lecture.goToSlide = function(slideNum) {
    _assert(typeof slideNum == 'number');
    _assert(! isNaN(slideNum));

    if (slideNum >= lecture._slideCount()) {
        slideNum = lecture._slideCount()-1;
    }
    if (slideNum < 0) {
        slideNum = 0;
    }
    var $activeSlide = $('.lecture_slide_active');
    var $newSlide = $($('.lecture_slide')[slideNum]);
    if ($activeSlide.is($newSlide)) return;
    $activeSlide.removeClass('lecture_slide_active');
    $activeSlide.addClass('lecture_slide_inactive');
    $newSlide.removeClass('lecture_slide_inactive');
    $newSlide.addClass('lecture_slide_active');
    $('#lecture_container').css({'counter-reset': 'lecture_slidenum ' + slideNum});
    lecture._scale();

    var newHash = '#s' + slideNum;
    if (window.location.hash != newHash) {
        window.location.hash = newHash;
    }
};

lecture._scale = function() {
    var WIDTH = 1024;
    var HEIGHT = 768;

    var _applyScale = function(scale) {
        var $slide = $('.lecture_slide_active');
        $slide.css({
            '-webkit-transform': 'scale(' + scale + ')',
            'width': WIDTH + 'px',
            'height': HEIGHT + 'px',
            'position': 'absolute',
            'top': '50%',
            'left': '50%',
            'margin-top': (-HEIGHT/2) + 'px',
            'margin-left': (-WIDTH/2) + 'px',
            'background': '#fff'
        });
    }

    var w = dataEl.width();
    var h = dataEl.height();
    if (!w || !h) return; // minimized window, ignore

    var xscale = w / WIDTH;
    var yscale = h / HEIGHT;
    if (xscale >= yscale) {
        _applyScale(yscale);
    } else {
        _applyScale(xscale);
    }
};

/**
 * Returns a jQuery object.
 */
lecture.renderSlide = function(sdata, chapterData) {
    _assert(sdata);
    _assert(chapterData);
    var $res = $('<div class="lecture_slide">');

    var $title = $("<h1>");
    $title.text(sdata["title"]);
    $res.append($title);

    var types = {};
    types.list = function(d) {
        var ul = document.createElement("ul");
        _assert(d.items, 'A list must have an "items" property');
        d.items.forEach(function(its) {
            var li = document.createElement("li");
            _assert($.isArray(its), 'List items must consist of a sequence of element descriptions', [its]);
            its.forEach(function(it) {
                li.appendChild(render(it));
            });
            ul.appendChild(li);
        });
        return ul;
    };
    types.text = function(d) {
        return document.createTextNode(d.text);
    };
    var render = function(d) {
        if (!d) return;

        _assert(d.type);
        var func = types[d.type];
        _assert(func);
        var node = func(d);
        return node;
    };

    var $contentContainer = $('<div class="lecture_slide_contentContainer">');
    var $contentWrapper = $('<div class="lecture_slide_content">');
    if (sdata.content) {
        _assert ($.isArray(sdata.content), 'content must be an array (or undefined)'); 
        sdata.content.forEach(function(cdata) {
            var $content = $(render(cdata));
            $contentWrapper.append($content);
        });
    }
    $contentContainer.append($contentWrapper);
    $res.append($contentContainer);
    
    var $footer = $('<footer>');
    var $footerTitle = $('<span class="lecture_footer_title">');
    $footerTitle.text(chapterData._lecture.name + ' \u2014 ' + chapterData.name);
    $footer.append($footerTitle);
    
    var $footerPagenum = $('<span class="lecture_footer_slidenum">');
    // Generated by CSS
    $footer.append($footerPagenum);
    $res.append($footer);
    return $res;
};

lecture.displayChapter = function(chapterData, slideCallback) {
    _assert(chapterData['_lecture']);

    dataEl.children().remove();

    var firstSlideDummy = $('<div>');
    firstSlideDummy.html(_render("lecture/frontSlide", chapterData));
    dataEl.append(firstSlideDummy.children());

    var slides = chapterData['slides'];
    slides.forEach(function(sdata) {
        var $slide = lecture.renderSlide(sdata, chapterData);
        if (slideCallback) {
            slideCallback($slide, sdata, chapterData);
        }
        dataEl.append($slide);
    });
};

lecture.admin = {};

lecture.admin._getSlideData = function($slide) {
    _assert($slide.hasClass('lecture_slide'));
    var res = $slide.data('slideData');
    _assert(res);
    return res;
};

lecture.admin._setSlideData = function($slide, sdata) {
    _assert(sdata);
    $slide.data('slideData', sdata);
};

lecture.admin._modifySlideData = function($slide, key, val) {
    var keys = key.split('.');
    _assert(keys.length >= 1);
    var lastKey = keys.pop();
    var sdata = lecture.admin._getSlideData($slide);
    var mdata = sdata;
    keys.forEach(function(k) {
       mdata = mdata[k];
       _assert(mdata);
    });
    mdata[lastKey] = val;
    lecture.admin._setSlideData($slide, sdata);
};

lecture.admin._makePlaceHolder = function($el, text) {
    $el.addClass('lecture_admin_placeholder');
    if (text) {
        $el.text(text);
    }
    // TODO on typing/paste/click, reset text and placeholder
};

/** Called just after slide creation */
lecture.admin.makeSlideEditable = function($slide) {
    _assert(! $slide.hasClass('lecture_frontSlide'));

    _assert(! $slide.attr('data-lecture-editable'));
    $slide.attr({'data-lecture-editable': 'true'});
    // Global shortcuts in edit mode
    $slide.bind('keydown', function(ev) {
        switch (ev.keyCode) {
        case 27: // Esc
            $slide.find(':focus').blur();
            lecture.hintStatus('Presentation mode');
            break;
        }

        // Hide keys from main lecture module while editing
        switch (ev.keyCode) {
        case 32: // Space
        case 40: // Down
        case 39: // Right
        case 32: // Space
        case 38: // Up
        case 37: // Left
        case 36: // Home
        case 35: // End
        case 67: // C
        case 69: // E
        case 84: // T
            ev.stopPropagation();
            break;
        };
    });

    var slideData = lecture.admin._getSlideData($slide);
    var $title = $slide.children('h1');
    var $contentContainer = $slide.find('.lecture_slide_content');

    if ($title.text() == "") {
        lecture.admin._makePlaceHolder($title, d2p.i18n('Click to set title'));
    }
    $title.attr({contentEditable: "true"});
    $title.bind('keydown', function(ev) {
        switch (ev.keyCode) {
        case 40: // Down
            _setSelection($contentContainer[0], true);
            ev.preventDefault();
            break;
        }
    });

    $contentContainer.attr({contentEditable: "true"});
    $contentContainer.bind('keydown', function(ev) {
        switch (ev.keyCode) {
        case 113: // F2
            _setSelection($title[0]);
            break;
        case 38: // Up
            if (_caretIsOnTop($contentContainer[0])) {
                _setSelection($title[0]);
            }
            break;
        }
    });
};

lecture.admin._enterEditMode = function(initialFocus, callFunc) {
    if (!initialFocus) initialFocus = 'h1'; // Focus title by default
    var $slide = $('.lecture_slide_active');
    var $initialFocus = $slide.find(initialFocus);
    $initialFocus.focus();
    if (callFunc) {
        callFunc($initialFocus, $slide);
    }
    lecture.hintStatus('Edit mode');
};

lecture.admin.installKeyHooks = function() {
    lecture.keyHooks[69 /* E */] = function() {
        lecture.admin._enterEditMode();
    }
    lecture.keyHooks[67 /* C */] = function() {
        lecture.admin._enterEditMode('.lecture_slide_content');
    };
    lecture.keyHooks[84 /* T */] = function() {
        lecture.admin._enterEditMode('h1', function($title) {
            _setSelection($title[0]);
        });
    }
};

lecture.admin.getBaseURL = function() {
    return $('#lecture').attr('data-baseurl');
};

lecture.admin.makeNewSlide = function() {
    var slideData = {};
    var $slide = lecture.renderSlide(slideData, lecture.admin._data);
    lecture.admin._setSlideData($slide, slideData);
    lecture.admin.makeSlideEditable($slide);
    dataEl.append($slide);
};

lecture.admin.displayChapter = function(chapterData) {
    lecture.displayChapter(chapterData, function($slide, sdata) {
        lecture.admin._setSlideData($slide, sdata);
        lecture.admin.makeSlideEditable($slide);
    });
};

$('.lecture_newChapter').click(function() {
    var form = $('<form>');

    d2p._ui_makeSetting('name', 'Name',
        {type: 'text', required: 'required', 'data-_lbltype': 'bold'},
        form);

    var submit = $('<input type="submit">');
    submit.attr({value: d2p.i18n('Create')});
    submit.appendTo(form);

    var dlg;
    form.bind('submit', function(e) {
        e.preventDefault();
        var url = lecture.admin.getBaseURL() + 'chapter/';
        var request = d2p._ui_getFormValues(form);

        d2p.sendQuery(url, request, function(res) {
            dlg.remove();
            var url = res['url'];
            d2p.content_goto(url);
        });
    });
    dlg = d2p._ui_makeCenterDialog(form, d2p.i18n('Create a new chapter'));
});

if (dataEl.length > 0) {
    var templatesJSON = dataEl.attr('data-lecture-templatesJSON');
    lecture.templates = JSON.parse(templatesJSON);

    var dataJSON = dataEl.attr('data-lecture-chapterJSON');
    var lectureData = JSON.parse(dataJSON);
    lectureData['slides'] = [
        {'title': 'First slide',
            content: [
            {type: 'text', 'text': 'Hier beginnt eine normale Aufzählung. Diese Aufzählung ist sehr lang, sie hat viel (manche Leute - bestimmt alles fies, wenn sie so etwas sagen (oder nicht ganz so doll - je nachdem, welche Motivation (einige Forscher sagen auch Hintegrund) - sie haben).'},
            {type: 'list', 'items': [
                [{'type': "text", "text": "XXXXX"}],
                [{'type': "text", "text": "Hello"}],
                [{'type': "text", "text": "world"}],
                [{'type': "text", "text": "Hi"}],
                [{'type': "text", "text": "This is a"},
                 {type: 'list', 'items': [
                    [{'type': "text", "text": "sub"}],
                    [{'type': "text", "text": "list"},
                        {type: 'list', items: [
                            [{'type': "text", "text": "dritte"}],
                            [{'type': "text", "text": "Ebene"}]
                        ]}
                    ]
                 ]}
                ]
            ]}]},
        {'title': 'Second slide'},
        {'title': 'Mindest-Verteilungszeit Peer-To-Peer',
        content: [
            {type:'list', items:[
                [{'type': "text", "text": "Dateigröße F(in Bit)"}]
            ]}
        ]}
    ];
    lecture.admin.installKeyHooks();
    lecture.admin._data = lectureData;
    lecture.admin.displayChapter(lectureData);

    lecture.admin.makeNewSlide();
    lecture.present();
}

});
