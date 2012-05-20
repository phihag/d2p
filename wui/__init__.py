
import tornado.ioloop
import tornado.web
import tornado.httpserver
import tornado.netutil

from .routes import routes

class WebUI(object):
    def __init__(self, cfg, io_loop, project_manager, netCore):
        webCfg = cfg.get('web', {})
        portSpec = webCfg.get('port', 2180)
        addrs = webCfg.get('addrs', ['::1', '127.0.0.1'])

        self._application = tornado.web.Application(routes, debug=cfg.get('debug', False))
        self._application.project_manager = project_manager
        self._application.netCore = netCore

        addrsIt = iter(addrs)
        sockets = []
        if portSpec == 0:
            a = next(addrsIt)
            s = tornado.netutil.bind_sockets(portSpec, a)
            sockets.extend(s)
            port = sockets[0].getsockname()[1]
        else:
            port = portSpec
        for a in addrsIt:
            s = tornado.netutil.bind_sockets(port, a)
            sockets.extend(s)
        self._port = port

        hs = tornado.httpserver.HTTPServer(self._application, io_loop=io_loop)
        hs.add_sockets(sockets)

    def getUrl(self):
        return 'http://localhost:' + str(self._port) + '/'

