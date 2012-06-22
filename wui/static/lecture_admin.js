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

lecture._onKeyDown = function(ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return; // Don't impede browser functionality

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
        //console.log(ev.keyCode);
        return;
    };
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

        _assert(d.type, '');
        var func = types[d.type];
        _assert(func);
        return func(d);
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
    // Disable keys while editing
    $slide.bind('keydown', function(ev) {
        switch (ev.keyCode) {
        case 32: // Space
        case 40: // Down
        case 39: // Right
        case 32: // Space
        case 38: // Up
        case 37: // Left
        case 36: // Home
        case 35: // End
            ev.stopPropagation();
            break;
        };
    });

    var _makeTextEditable = function($textElement, key) {
        $textElement.attr({contentEditable: "true"});
    };

    var slideData = lecture.admin._getSlideData($slide);
    var $title = $slide.children('h1');
    if ($title.text() == "") {
        lecture.admin._makePlaceHolder($title, d2p.i18n('Click to set title'));
    }
    _makeTextEditable($title, 'title');
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
            {type: 'text', 'text': 'Hier beginnt eine normale Aufzählung'},
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
    lecture.admin._data = lectureData;
    lecture.admin.displayChapter(lectureData);

    lecture.admin.makeNewSlide();
    lecture.present();
}

});
