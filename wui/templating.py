
import functools
import json
import os.path
import pystache
import tornado.web
import re

TEMPLATE_PATH = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates'))

class TemplateLoader(object):
    def get(self, template_name):
        fn = os.path.normpath(os.path.join(TEMPLATE_PATH, template_name + '.mustache'))
        if not fn.startswith(TEMPLATE_PATH + os.path.sep):
            raise ValueError('Invalid template name')

        with open(os.path.join(fn), 'r') as tf:
            return tf.read()
    read = get
    load_name = get

def render(template_name, context):
    renderer = pystache.Renderer(string_encoding='utf-8', partials=TemplateLoader())
    renderer._make_loader = TemplateLoader
    return renderer.render_path(template_name, context)

def _parseAccept(acceptHeader):
    """ Returns a sorted list of MIME types in order of preference.
    We don't implement RFC 2616.14.1 fully, see https://twitter.com/#!/phihag/status/203417465231908864
    Since the de-facto usage takes into account the order of media types.
    """

    entries = []
    for mr in acceptHeader.split(','):
        m = re.search(';\s*q=([0-9.]+)', mr)
        if m:
            mr = mr[:m.span()[0]] + mr[m.span()[1]:]
            q = float(m.group(1))
        else:
            q = 1
        entries.append((q, mr))
    entries.sort(key=lambda e: -e[0]) # Guaranteed to be stable
    return [e[1] for e in entries]

def _findMime(acceptHeader, supported, default=None):
    """ Find the closest mime type in the accept header.
    acceptHeader may be None (no header given).
    supported is a container of supported MIME types.
    Note that the order may matter - if in doubt, we pick the first matching value.
    You can set default= to prevent that (except for wildcards with types like "text/*").
    If the acceptHeader is given, but does not include */*, we may raise a KeyError.
    """

    if default is None:
        default = next(iter(supported))
    if acceptHeader is None:
        return default

    accepted = _parseAccept(acceptHeader)
    for a in accepted:
        if a == '*/*':
            return default
        if a.endswith('/*'):
            try:
                return next(s for s in supported if s.startswith(a[:-1]))
            except StopIteration:
                continue # Unmatched media type range
        try:
            return next(s for s in supported if s == a)
        except StopIteration:
            continue # Unmatched media type

    raise KeyError('Could not match any accept header')

class TemplatingHandler(tornado.web.RequestHandler):
    def render(self, data):
        assert 'template' in data
        assert 'title' in data

        def renderJSON(includeHTML, data):
            if includeHTML:
                data['contenthtml'] = render(data['template'], data)

            bs = json.dumps(data, indent=4).encode('UTF-8')
            self.add_header('Content-Type', 'application/json; charset=UTF-8')
            self.write(bs)

        def renderHtml(data):
            contentHtml = render(data['template'], data)

            serverName = self.request.host
            localPort = self.request.connection.stream.socket.getsockname()[1]
            serverId = self.request.protocol + '://' + self.request.host

            fallbacks = [
                    {"urlbase": "http://normsetzung1.phihag.de", "name": "normsetzung1.phihag.de"},
                    {"urlbase": "http://normsetzung2.phihag.de", "name": "normsetzung2.phihag.de"},
                    {"urlbase": "http://localhost:2180", "name": "localhost:2180"}
                ]
            fallbacks = list(filter(lambda h: h['urlbase'] != serverId, fallbacks))

            clientConfig = {
                "serverName": serverName,
                "fallbacks": fallbacks
            }
            self.write(render('root', {
                'title': data['title'],
                'configJSON': json.dumps(clientConfig),
                'content': contentHtml,
                'stylesheets': data.get('stylesheets', []),
                'scripts': data.get('scripts', []),
                'hideHeader': data.get('hideHeader', False),
            }))

        formats = {
            'json': functools.partial(renderJSON, True),
            'application/json': functools.partial(renderJSON, True),
            'application/json;includeHTML=true': functools.partial(renderJSON, True),
            'application/json;includeHTML=false': functools.partial(renderJSON, False),
            'text/html': renderHtml,
            'html': renderHtml,
        }

        reqFormat = self.get_argument('format', self.request.headers.get('Accept'))
        mt = _findMime(reqFormat, formats, 'text/html')
        formats[mt](data)

