
import json
import os.path
import pystache
import tornado.web

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')

def _getTemplateCode(template_name):
    with open(os.path.join(TEMPLATE_PATH, template_name + '.mustache'), 'r') as tf:
        return tf.read()

def render(template_name, context):
    return _PystacheTemplate(_getTemplateCode(template_name), context).render()

class _PystacheTemplate(pystache.Template):
    def __init__(self, *args, **kwargs):
        super(_PystacheTemplate, self).__init__(*args, **kwargs)
        self.modifiers.set('>')(_PystacheTemplate._render_partial)

    def _render_partial(self, template_name):
        markup = _getTemplateCode(template_name)
        template = _PystacheTemplate(markup, self.view)
        return template.render()

class TemplatingHandler(tornado.web.RequestHandler):
    def render(self, data):
        assert 'template' in data

        acceptHeader = self.request.headers.get('Accept')
        # TODO Skip rendering when the accept header says that the client doesn't need the HTML
        # TODO By default, serve full-page HTML instead of JSON (change current JSON requests)

        data['contenthtml'] = render(data['template'], data)
        
        bs = json.dumps(data, indent=4).encode('UTF-8')
        self.add_header('Content-Type', 'application/json; charset=UTF-8')
        self.write(bs)
