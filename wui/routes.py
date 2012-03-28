
import os.path

from .root import RootHandler,ManifestHandler
from .static import StaticFileHandler
from .fallback import PingHandler,WSPingHandler
from .projects import ListProjectsHandler,CreateProjectHandler,ConoProjectShowHandler,ProjectCASHandler,ProjectDocumentDBHandler,ConoProposalHandler,ConoCommentHandler
from .transports import DTNHandler,DTNEndpointHandler,P2PHandler,P2PBootstrapHandler,P2PManualBootstrapHandler
from . import templating

_STATIC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

routes = [
    (r"/", RootHandler),
    (r"/manifest", ManifestHandler, {
    'staticFileInfo': {
        ('/static/', _STATIC_PATH, ('*.js', '*.css', 'icons/*.png', 'icons/*.gif')),
        ('/', _STATIC_PATH, ('favicon.ico',)),
    },
    'templateFileInfo': {
        ('/templates/', templating.TEMPLATE_PATH, ('*.mustache')),
    },
    }),
    (r"/ping", PingHandler),
    (r"/wsping", WSPingHandler),
    (r"/static/(.*)", StaticFileHandler, {'path': _STATIC_PATH}),
    (r"/(favicon\.ico)", StaticFileHandler, {'path': _STATIC_PATH}),
    (r"/p/", ListProjectsHandler),
    (r"/p/([0-9a-f]+)/", ConoProjectShowHandler),
    (r"/p/([0-9a-f]+)/cas/", ProjectCASHandler),
    (r"/p/([0-9a-f]+)/docdb/", ProjectDocumentDBHandler),
    (r"/p/([0-9a-f]+)/([0-9a-f]+)/", ConoProposalHandler),
    (r"/p/([0-9a-f]+)/([0-9a-f]+)/rev_([0-9a-f]+)/", ConoProposalHandler),
    (r"/p/([0-9a-f]+)/([0-9a-f]+)/submitComment", ConoCommentHandler),
    (r"/p/([0-9a-f]+)/submitProposal", ConoProposalHandler),
    (r"/createProject", CreateProjectHandler),
    (r"/_transports/dtn/", DTNHandler),
    (r"/_transports/dtn/([0-9a-f]+)/([0-9a-zA-Z]*)", DTNEndpointHandler),
    (r"/_transports/p2p/", P2PHandler),
    (r"/_transports/p2p/bootstrap/", P2PBootstrapHandler),
    (r"/_transports/p2p/bootstrap/([0-9a-zA-Z]+)/manual/entries/", P2PManualBootstrapHandler),
]
