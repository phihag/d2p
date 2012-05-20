d2p.project = {
    get_baseUrl: function() {
        return $('#projectdata').attr('data-baseurl');
    }
};

$(function() {
    var cono_viewlink_click = function() {
        var href = $(this).attr('data-href');
        var url = d2p.project.get_baseUrl() + href;
        d2p.content_goto(url);
    };
    
    
    $('#content .button_to_projectlist').click(function() {
        d2p.content_goto('/p/');
    });

    $('#content .project_viewbutton').each(function() {
        var curUrl = d2p.content_curUrl();
        var href = $(this).attr('data-href');
        var url = d2p.project.get_baseUrl() + href;
        if (url == curUrl) {
            $(this).addClass('commandbutton_disabled');
        }
    });

    $('#content .project_viewbutton, .viewlink').click(cono_viewlink_click);

    $('.project_proposal_new_button').click(function() {
        var form = $('<form>');

        d2p._ui_makeSetting('title', 'Title',
            {type: 'text', required: 'required', 'data-_lbltype': 'boldnl'},
            form);
        d2p._ui_makeSetting('description', 'Description',
            {type: 'textarea', required: 'required', 'data-_lbltype': 'boldnl', cols: 60, rows: 10},
            form);

        var submit = $('<input type="submit">');
        submit.attr({value: d2p.i18n('Create')});
        submit.appendTo(form);

        var dlg;
        form.bind('submit', function(e) {
            e.preventDefault();
            var url = d2p.project.get_baseUrl() + 'submitProposal';
            var request = d2p._ui_getFormValues(form);

            d2p.sendQuery(url, request, function(res) {
                dlg.remove();
                var purl = res['proposal_url'];
                d2p.content_goto(purl);
            });

            return false;
        });

        dlg = d2p._ui_makeCenterDialog(form, 'Create a new proposal');
    });

    $('.project_proposal_edit_button').click(function() {
        var proposalEl = $('.cono_proposal');

        var form = $('<form>');

        var titleInput = $('<input type="text" required="required" class="cono_proposal_title">');
        titleInput.val(proposalEl.attr('data-proposal-title'));
        titleInput.appendTo(form);

        var descriptionInput = $('<textarea required="required" class="cono_proposal_description" rows="10">');
        descriptionInput.val(proposalEl.attr('data-proposal-description'));
        descriptionInput.appendTo(form);

        var saveButton = $('<input type="submit">');
        saveButton.attr({value: d2p.i18n('Save Proposal')});
        saveButton.appendTo(form);

        form.bind('submit', function(e) {
            e.preventDefault();
            var proposalData = {
                'title': $('.cono_proposal_title').val(),
                'description': $('.cono_proposal_description').val()
            };
            var proposalId = $('.cono_proposal').attr('data-proposal-id');
            var url = d2p.project.get_baseUrl() + proposalId + '/';

            d2p.sendQuery(url, proposalData, function(res) {
                d2p.content_goto(res.url);
            });
            console.log("Sent query ...");
        });

        proposalEl.children().remove();
        form.appendTo(proposalEl);
        titleInput.focus();
        $('.project_proposal_edit_button').addClass('commandbutton_disabled');
    });

    $('.project_proposal_revisions_button').click(function() {
        var proposalEl = $('.cono_proposal');
        var revisionsJSON = proposalEl.attr('data-proposal-revisions_json');
        revisions = JSON.parse(revisionsJSON);

        var proposalBase = proposalEl.attr('data-proposal-id') + '/';
        var curRev = proposalEl.attr('data-proposal-rev');

        var revList = $('<ul>');
        _.each(revisions, function(rev) {
            var li = $('<li class="viewlink">');
            li.attr('data-rev', rev);
            li.text(rev);
            li.attr({'data-href': proposalBase + 'rev_' + rev + '/'});
            if (curRev == rev) {
                li.addClass('cono_proposal_rev_current');
            }
            li.bind('click', function() {
                dlg.remove();
            });
            li.bind('click', cono_viewlink_click);
            li.appendTo(revList);
        });
        var newestLi = $('<li class="viewlink">');
        newestLi.text(d2p.i18n('Newest revision'));
        newestLi.attr({'data-href': proposalBase});
        newestLi.appendTo(revList);
        newestLi.bind('click', function() {
            dlg.remove();
        });
        newestLi.bind('click', cono_viewlink_click);


        var dlg = d2p._ui_makeCenterDialog(revList, 'Select revision');
        
    });
    
    $('#cono_commentform').submit(function(e) {
        e.preventDefault();
        var commentData = {
            'text': $('.cono_comment_text').val(),
        };
        var proposalUrl = $('.cono_proposal').attr('data-proposal-baseurl');
        var url = proposalUrl + 'submitComment';

        d2p.sendQuery(url, commentData, function() {
            d2p.content_goto(proposalUrl);
        });
    });
});
