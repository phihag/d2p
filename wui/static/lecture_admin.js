// TODO capture hashchange for slide
// TODO shortcuts, ? should bring up a help screen

var lecture = {};
(function() {
var _assert = function(b, s) {
    if (!s) {
        s = "";
    }
    if (!b) {
        throw new Error("Assertion failed: " + s);
    }
};

lecture.renderChapter = function(chapterData) {
    _assert(chapterData._lectureName);
    _assert(lecture.templates["chapter"]);

    
};

lecture.admin = {};
lecture.admin.getBaseURL = function() {
    return $('#lecture').attr('data-baseurl');
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

if ($('#lecture_chapter_container').length > 0) {
    var templatesJSON = $('#lecture_chapter_container').attr('data-lecture-templatesJSON');
    lecture.templates = JSON.parse(templates);
    
    var dataJSON = $('#lecture_chapter_container').attr('data-lecture-chapterJSON');
    var data = JSON.parse(dataJSON);
    lecture.renderChapter(data);
}

})();
