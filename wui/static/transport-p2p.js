$(function() {

$('#p2p_bootstrap_addform').submit(function() {
    var bsType = $('#p2p_bootstrap_type').val();
    var q = {'bsType': bsType};
    var url = '/_transports/p2p/bootstrap/';
    d2p.sendQuery(url, q, function() {
        d2p.content_goto('/_transports/p2p/');
    });
});

$('.p2p_bootstrap[data-bootstrap-type="manual"]').each(function(i, el) {
    var bsEl = $(el);

    var entryTable = bsEl.find('.p2p_bootstrap_entries');
    var newRow = $('<tr class="p2p_bootstrap_newRow">');

    var transportIds = ['p2p-ipv6-tcp'];
    var inputTransportIds = $('<select>');
    _.each(transportIds, function(ti) {
        var opt = $('<option>');
        opt.attr({'value': ti});
        opt.text(ti);
        inputTransportIds.append(opt);
    });
    var td = $('<td>');
    inputTransportIds.appendTo(td);
    td.appendTo(newRow);

    var inputAddr = $('<input type="text" required="required">');
    inputAddr.attr({'placeholder': d2p.i18n('IP address')});
    var td = $('<td>');
    inputAddr.appendTo(td);
    td.appendTo(newRow);

    var inputPort = $('<input type="text">');
    inputPort.attr({'placeholder': d2p.i18n('Port'), size: 5})
    var td = $('<td>');
    inputPort.appendTo(td);
    var submit = $('<input type="button">');
    submit.attr({value: d2p.i18n('Add entry')});
    submit.appendTo(td);
    td.appendTo(newRow);

    submit.click(function() {
        var entry = {
            'transportId': inputTransportIds.val(),
            'addr': inputAddr.val(),
            'port': inputPort.val()
        };

        var url = '/_transports/p2p/bootstrap/' + bsEl.attr('data-bootstrap-id') + '/manual/entries/';
        d2p.sendQuery(url, entry, function() {
            d2p.content_goto('/_transports/p2p/');
        });
    });
    
    entryTable.find('tbody').append(newRow);
});

});