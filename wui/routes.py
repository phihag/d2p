
import os.path

from .root import RootHandler,ManifestHandler
from .static import StaticFileHandler
from .fallback import PingHandler,WSPingHandler
from .projects import ListProjectsHandler,CreateProjectHandler
from . import cono_projects
from . import lecture
from .transports import DTNHandler,DTNEndpointHandler,P2PHandler,P2PBootstrapHandler,P2PManualBootstrapHandler
from . import templating

_STATIC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

routes = ([
    (r"/", RootHandler),
    (r"/manifest", ManifestHandler, {
    'staticFileInfo': {
        ('/static/', _STATIC_PATH, ('*.js', '*.css', 'icons/*.png', 'icons/*.gif')),
        ('/', _STATIC_PATH, ('favicon.ico',)),
    },
    'templateFileInfo': {
        ('/templates/', templating.TEMPLATE_PATH, ('*.mustache',)),
    },
    }),
    (r"/ping", PingHandler),
    (r"/wsping", WSPingHandler),
    (r"/static/(.*)", StaticFileHandler, {'path': _STATIC_PATH}),
    (r"/(favicon\.ico)", StaticFileHandler, {'path': _STATIC_PATH}),
    (r"/templates/(.*)", StaticFileHandler, {'path': templating.TEMPLATE_PATH}),
    (r"/p/", ListProjectsHandler),]
    + cono_projects.routes(r"/p/([0-9a-f]+)/cono")
    + lecture.routes(r"/p/([0-9a-f]+)/lecture")
    + [
    (r"/createProject", CreateProjectHandler),
    (r"/_transports/dtn/", DTNHandler),
    (r"/_transports/dtn/([0-9a-f]+)/([0-9a-zA-Z]*)", DTNEndpointHandler),
    (r"/_transports/p2p/", P2PHandler),
    (r"/_transports/p2p/bootstrap/", P2PBootstrapHandler),
    (r"/_transports/p2p/bootstrap/([0-9a-zA-Z]+)/manual/entries/", P2PManualBootstrapHandler),
])
