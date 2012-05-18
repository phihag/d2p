var lecture = {};
lecture.getBaseURL = function() {
    return $('#lecture').attr('data-baseurl');
};

$('.lecture_newChapter').click(function() {
    var form = $('<form>');

    d2p._ui_makeSetting('name', 'Name',
        {type: 'text', required: 'required', 'data-_lbltype': 'boldnl'},
        form);

    var submit = $('<input type="submit">');
    submit.attr({value: d2p.i18n('Create')});
    submit.appendTo(form);

    var dlg;
    form.bind('submit', function() {
        var url = lecture.getBaseURL() + 'chapter/';
        var request = d2p._ui_getFormValues(form);

        d2p.sendQuery(url, request, function(res) {
            dlg.remove();
            var url = res['url'];
            d2p.content_goto(url);
        });

        return false;
    });
    dlg = d2p._ui_makeCenterDialog(form, 'Create a new proposal');
});
