"use strict";

// TODO capture hashchange for slide
// TODO shortcuts, ? should bring up a help screen

var lecture = {};
$(function() {
var dataEl = $('#lecture_container');

lecture._osxhi = osxh({allowCSS: true});

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

var _findNodeInHierarchy = function(n, tagName, untilNode) {
    while (n.nodeType != Node.ELEMENT_NODE || n.tagName != tagName) {
        if (n === untilNode) {
            return null;
        }
        n = n.parentNode;
        _assert(n);
        if (n.tagName == 'HTML') {
            throw new Error('Boundary of document reached');
        }
    }
    return n;
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
lecture.prioKeyHooks = {};

lecture._onKeyDown = function(ev) {
    if (lecture.prioKeyHooks[ev.keyCode]) {
        var goOn = lecture.prioKeyHooks[ev.keyCode](ev);
        if (goOn === false) {
            return false;
        }
    }

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

    var $title = $('<h1 class="lecture_slide_title">');
    $title.text(sdata["title"]);
    $res.append($title);

    var $contentContainer = $('<div class="lecture_slide_contentContainer">');
    var $contentWrapper = $('<div class="lecture_slide_content">');
    if (sdata.content) {
        _assert (typeof sdata.content === 'string', 'content must be an OSXH string'); 
        lecture._osxhi.renderInto(sdata.content, $contentWrapper[0]);
    }
    $contentContainer.append($contentWrapper);
    $res.append($contentContainer);
    
    var $footer = $('<footer>');
    var $footerTitle = $('<span class="lecture_footer_title">');
    var $lectureName = $('<span>');
    if (chapterData._lecture.baseurl) {
        $lectureName = $('<a>');
        $lectureName.attr({href: chapterData._lecture.baseurl});
    }
    $lectureName.text(chapterData._lecture.name);
    $footerTitle.append($lectureName);
    $footerTitle.append($(document.createTextNode(' \u2014 ' + chapterData.name)));
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

lecture.admin._assertSaveCorrect = function() {
    var orig = lecture.admin._data.slides;
    var saved = lecture.admin._collectSlideData();
    if (! _.isEqual(orig, saved)) {
        var saved_json = JSON.stringify(saved, null, 4);
        var cdata_json = JSON.stringify(orig, null, 4);
        console.log('Expected: ', cdata_json);
        console.log('Got: ', saved_json);
    }
}

lecture.admin._collectSlideData = function() {
    var res = [];
    dataEl.children('.lecture_slide').filter(':not(.lecture_frontSlide)').each(function(i, slide) {
        var $slide = $(slide);
        var sdata = {};

        var $title = $slide.find($('.lecture_slide_title'));
        if (! $title.hasClass('lecture_admin_placeholder')) {
            sdata.title = $title.text();
        }

        var $slideContentContainer = $slide.find('.lecture_slide_content');
        _assert($slideContentContainer.length == 1, 'Found ' + $slideContentContainer.length + ' slide containers (expected one)');
        var contentNodes = $slideContentContainer[0].childNodes;
        if (contentNodes.length > 0) {
            sdata.content = lecture._osxhi.serialize(contentNodes);
        }

        if ((typeof sdata.title != 'undefined') || (typeof sdata.content != 'undefined')) {
            res.push(sdata);
        }
    });

    return res;
};

lecture.admin.save = function() {
    var sdata = lecture.admin._collectSlideData();
    var slidesJSON = JSON.stringify(sdata);
    var ldata = lecture.admin._data;
    var curl = ldata._lecture.baseurl + 'chapter/' + ldata._id + '/';
    console.log(curl);
    var cdata = {
        name: ldata.name,
        slidesJSON: slidesJSON
    };

    d2p.sendQuery(curl, cdata, function() {
        lecture.hintStatus('Saved.');
    });
};

lecture.admin._makePlaceHolder = function($el, text) {
    var _updateStatus = function(beforeInput) {
        if ($el.hasClass('lecture_admin_placeholder')) {
            if (beforeInput) {
                $el.removeClass('lecture_admin_placeholder');
                $el.text('');
            }
        } else {
            if ($el.text() == '') {
                $el.addClass('lecture_admin_placeholder');
                if (text) {
                    $el.text(text);
                }
            }
        }
    };
    _updateStatus();

    $el.bind('keydown', function() {_updateStatus(true);});
    $el.bind('keyup', function() {_updateStatus();});
    $el.bind('blur', function() {_updateStatus();});
};

/** Called just after slide creation */
lecture.admin.makeSlideEditable = function($slide) {
    _assert(! $slide.hasClass('lecture_frontSlide'));

    _assert(! $slide.attr('data-lecture-editable'));
    $slide.attr({'data-lecture-editable': 'true'});
    // Global shortcuts in edit mode
    $slide.bind('keydown', function(ev) {
        if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;

        switch (ev.keyCode) {
        case 27: // Esc
            $slide.find(':focus').blur();
            lecture.hintStatus('Presentation mode');
            ev.preventDefault();
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

    var $title = $slide.children('.lecture_slide_title');
    var $contentContainer = $slide.find('.lecture_slide_content');

    if ($title.text() == "") {
        lecture.admin._makePlaceHolder($title, d2p.i18n('Slide title'));
    }
    $title.attr({contentEditable: "true"});
    $title.bind('keydown', function(ev) {
        if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;

        switch (ev.keyCode) {
        case 40: // Down
            _setSelection($contentContainer[0], true);
            ev.preventDefault();
            break;
        }
    });

    $contentContainer.attr({contentEditable: "true"});
    $contentContainer.bind('keydown', function(ev) {
        if (ev.altKey || ev.ctrlKey || ev.metaKey) return;

        if (ev.shiftKey) {
            switch (ev.keyCode) {
            case 9: // Tab
                break; // Will be handled by standard handler
            default:
                return;
            }
        }

        switch (ev.keyCode) {
        case 9: // Tab
            ev.stopPropagation();
            ev.preventDefault();

            var action = ev.shiftKey ? 'dedent' : 'indent';

            var sel = window.getSelection();
            if (sel.rangeCount == 0) {
                lecture.hintStatus('Nothing selected. Cannot ' + action + '.');
                return;
            };

            var r = sel.getRangeAt(0);
            var rsav = {
                startContainer: r.startContainer,
                startOffset: r.startOffset,
                endContainer: r.endContainer,
                endOffset: r.endOffset
            };
            var li = _findNodeInHierarchy(r.startContainer, 'LI', $contentContainer[0]);
            if (!li) {
                if (action == 'indent') {
                    var move = r.startContainer;
                    if (move == $contentContainer[0]) {
                        move = document.createTextNode('');
                        $contentContainer[0].appendChild(move);
                    }
                    if (move.nextSibling && move.nextSibling.tagName == 'BR') {
                        $(move.nextSibling).remove();
                    }

                    var prevList, nextList;
                    if (move.previousSibling && move.previousSibling.tagName === 'UL') {
                        prevList = move.previousSibling;
                    }
                    if (move.nextSibling && move.nextSibling.tagName === 'UL') {
                        nextList = move.nextSibling;
                    }
                    if (!prevList && !nextList) {
                        prevList = document.createElement('ul');
                        $contentContainer[0].insertBefore(prevList, move.nextSibling);
                    }

                    var li = document.createElement('li');
                    li.appendChild(move);
                    if (prevList) {
                        $(prevList).append($(li));

                        if (nextList) {
                            $(nextList).children().each(function (i, node) {
                                $(prevList).append($(node));
                            });
                            $(nextList).remove();
                        }
                    } else {
                        $(nextList).prepend($(li));
                    }
                    
                    sel.removeAllRanges();
                    var newRange = document.createRange();
                    newRange.setStart(move, rsav.startOffset);
                    newRange.setEnd(move, rsav.endOffset);
                    sel.addRange(newRange);
                } else {
                    lecture.hintStatus('Cannot ' + action + ' - outside of any lists');
                }
                return;
            }

            if (action == 'indent') {
                var newParent = li.previousSibling;
                if (!newParent) {
                    // Create a new <li> element at the current level, and make el its child
                    newParent = document.createElement('li');
                    li.parentNode.insertBefore(newParent, li);

                    // Allow editing of the new element
                    var tn = document.createElement('span');
                    tn.setAttribute('class', 'lecture_placeholder');
                    newParent.appendChild(tn);
                }
                var ul;
                if (newParent.lastChild && newParent.lastChild.nodeType == Node.ELEMENT_NODE && newParent.lastChild.tagName == 'UL') {
                    ul = newParent.lastChild;
                } else {
                    ul = document.createElement('ul');
                    newParent.appendChild(ul);
                }
                li.parentNode.removeChild(li);
                ul.appendChild(li);
            } else { // dedent
                var ul = li.parentNode;

                // Move the rest of the list into the current node
                if (li.nextSibling) {
                    var bottomUL = document.createElement('ul');
                    var moveInNew = li.nextSibling;
                    while (moveInNew) {
                        ul.removeChild(moveInNew);
                        bottomUL.appendChild(moveInNew);
                        moveInNew = moveInNew.nextSibling;
                    }
                    li.appendChild(bottomUL);
                }

                // Reattach node
                var parentLI = _findNodeInHierarchy(ul.parentNode, 'LI', $contentContainer[0]);
                ul.removeChild(li);
                if (parentLI) {
                    parentLI.parentNode.insertBefore(li, parentLI.nextSibling);
                } else { // We're a list element at top level
                    var childrenToMove = [];
                    for (var i = 0;i < li.childNodes.length;i++) {
                        childrenToMove.push(li.childNodes[i]);
                    }
                    var insertBefore = ul.nextSibling;
                    childrenToMove.forEach(function(c) {
                        ul.parentNode.insertBefore(c, insertBefore);
                    });
                    /*var br = document.createElement('br');
                    ul.parentNode.insertBefore(br, ul.nextSibling);*/
                }

                // Remove list if it's empty now
                if (ul.childNodes.length == 0) {
                    ul.parentNode.removeChild(ul);
                }
            }

            // Restore range from manual copy (since we've moved DOM elements, r has been corrupted)
            sel.removeAllRanges();
            var newRange = document.createRange();
            newRange.setStart(rsav.startContainer, rsav.startOffset);
            newRange.setEnd(rsav.endContainer, rsav.endOffset);
            sel.addRange(newRange);
            break;
        case 38: // Up
            if (_caretIsOnTop($contentContainer[0])) {
                _setSelection($title[0], true);
                ev.stopPropagation();
                ev.preventDefault();
            }
            break;
        }
    });
};

lecture.admin._enterEditMode = function(initialFocus, callFunc) {
    if (!initialFocus) initialFocus = '.lecture_slide_title'; // Focus title by default
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
    };
    lecture.keyHooks[67 /* C */] = function() {
        lecture.admin._enterEditMode('.lecture_slide_content');
    };
    lecture.keyHooks[84 /* T */] = function() {
        lecture.admin._enterEditMode('.lecture_slide_title', function($title) {
            _setSelection($title[0]);
        });
    };
    lecture.keyHooks[113 /* F2 */] = function() {
        lecture.admin._enterEditMode('.lecture_slide_title', function($title) {
            _setSelection($title[0]);
        });
    };

    lecture.prioKeyHooks[83 /* S */] = function(e) {
        if (e.ctrlKey) {
            e.preventDefault();
            lecture.admin.save();
            return false;
        }
    };

};

lecture.admin.getBaseURL = function() {
    return $('#lecture').attr('data-baseurl');
};

lecture.admin.makeNewSlide = function() {
    var slideData = {};
    var $slide = lecture.renderSlide(slideData, lecture.admin._data);
    lecture.admin.makeSlideEditable($slide);
    dataEl.append($slide);
};

lecture.admin.displayChapter = function(chapterData) {
    lecture.displayChapter(chapterData, function($slide, sdata) {
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
    lecture.admin.installKeyHooks();
    lecture.admin._data = lectureData;
    lecture.admin.displayChapter(lectureData);

    lecture.admin.makeNewSlide();
    lecture.present();
}

});
