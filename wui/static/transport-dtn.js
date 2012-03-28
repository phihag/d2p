$(function() {

$('.button_dtn_enable').click(function() {
    var endpointId = $(this).parent().attr('data-endpoint-id');
    var endpointUrl = '/_transports/dtn/' + endpointId + '/';
    var url = endpointUrl + 'enable';

    d2p.sendQuery(url, {}, function() {
        d2p.content_goto(endpointUrl);
    });
});


$('.button_dtn_disable').click(function() {
    var endpointId = $(this).parent().attr('data-endpoint-id');
    var endpointUrl = '/_transports/dtn/' + endpointId + '/';
    var url = endpointUrl + 'disable';

    d2p.sendQuery(url, {}, function() {
        d2p.content_goto('/_transports/dtn/');
    });
});


$('.endpoint_info').each(function (i, el) {
    var $el = $(el);
    if ($el.parent().attr('data-active') == 'true') {
        $el.addClass('viewlink');
        $el.click(function() {
            var endpointId = $(this).parent().attr('data-endpoint-id');
            var endpointUrl = '/_transports/dtn/' + endpointId + '/';
            d2p.content_goto(endpointUrl);
        });
    }
});

$('.button_to_dtnlist').click(function() {
    d2p.content_goto('/_transports/dtn/');
});

$('.dtn_endpoint_projects').submit(function() {
    var endpointId = $('.dtn_endpoint').attr('data-endpoint-id');
    var endpointUrl = '/_transports/dtn/' + endpointId + '/';
    var url = endpointUrl + 'addProject';

    var projectId = $('#dtn_endpoint_project_selection').val();
    d2p.sendQuery(url, {'projectId': projectId}, function() {
        d2p.content_goto(endpointUrl);
    });

    return false;
});

$('.button_dtn_import_project').click(function() {
    var endpointId = $('.dtn_endpoint').attr('data-endpoint-id');
    var endpointUrl = '/_transports/dtn/' + endpointId + '/';
    var url = endpointUrl + 'importProject';
    var projectId = $(this).parent().attr('data-project-id');

    d2p.sendQuery(url, {'projectId': projectId}, function(res) {
        d2p.content_goto(res['projectUrl']);
    });
});

});