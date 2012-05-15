
$(function() {
    $('#content .button_addproject').click(function () {
        var form = $('<form></form>');
        d2p._ui_makeSetting('name', 'Name', {type: 'text', 'data-_lbltype': 'bold', 'placeholder': d2p.i18n('Democracy in Elbonia')}, form);
        d2p._ui_makeSetting('ptype', 'Type',
            {type: 'select', 'data-_lbltype': 'bold',
                '_options': {
                    'cono': d2p.i18n('Cooperative normsetting'),
                    'lecture': d2p.i18n('Lecture')
                }
            }, form);
        var submit = $('<input type="submit">');
        submit.attr({value: d2p.i18n('Create project')});
        form.append(submit);

        form.bind('submit', function() {
            var data = d2p._ui_getFormValues(form);
            d2p.sendQuery('/createProject', data, function(res) {
                wrapper.remove();
                d2p.content_goto(res.url);
            });
            return false;
        });

        var wrapper = d2p._ui_makeCenterDialog(form, d2p.i18n('Add Project ...'));
    });
});