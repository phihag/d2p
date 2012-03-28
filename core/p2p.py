
import errno
import functools
import socket
import struct
import tornado.ioloop
import tornado.iostream
from . import bootstrap

_MSG_HEADER = b'D2P_MSG:'

class P2PEndpoint(object):
    def __init__(self, iostream, netCore, io_loop):
        self._iostream = iostream
        self._netCore = netCore
        self._io_loop = io_loop
        self._io_loop.add_callback(self._read)

    @property
    def ui_localPort(self):
        return self._iostream.socket.getsockname()[1]

    @property
    def ui_remoteAddrStr(self):
        pn = self._iostream.socket.getpeername()
        return pn[0] + ':' + str(pn[1])

    def _read(self):
        HEADER_LEN = len(_MSG_HEADER) + 8

        def onHeader(bs):
            assert len(bs) == HEADER_LEN
            assert bs[:len(_MSG_HEADER)] == _MSG_HEADER
            byteNum = struct.unpack('!Q', bs[len(_MSG_HEADER):])[0]
            def readMsg(bs):
                assert len(bs) == byteNum
                self._netCore.onRecv(self, bs)
                 # Read the next message
                self._io_loop.add_callback(self._read)
            self._iostream.read_bytes(byteNum, readMsg)

        self._iostream.read_bytes(HEADER_LEN, onHeader)

    def send(self, bs):
        assert isinstance(bs, bytes)
        self._iostream.write(_MSG_HEADER + struct.pack('!Q', len(bs)) + bs)

class P2PTransport(object):
    transport_id = 'p2p-ipv6-tcp'

    def __init__(self, io_loop, netCore, cfg):
        self._io_loop = io_loop
        self._netCore = netCore
        self._bootstraps = []
        self._bootstraps_nextId = 0
        self._endpoints = []

        self._servSock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        self._servSock.setblocking(0)
        self._servSock.bind(('::', 0))
        self._servSock.listen(128)

        # Register add_handler to be called when we can accept a connection
        self._io_loop.add_handler(self._servSock.fileno(),
                                  self._handle_events,
                                  tornado.ioloop.IOLoop.READ)

        p2pCfg = cfg.get('p2p', {})
        bootstrapCfg = cfg.get('bootstraps', [{
            'bsType': 'manual',
        }])
        for bcfg in bootstrapCfg:
            bs = bootstrap.create(bcfg)
            self._addBootstrap(bs)

    def _handle_events(self, fd, events):
        assert fd == self._servSock.fileno()
        while True:
            try:
                connection, address = self._servSock.accept()
            except socket.error as e:
                if e.args[0] in (errno.EWOULDBLOCK, errno.EAGAIN):
                    return
                raise

            connection.setblocking(0)
            ios = tornado.iostream.IOStream(connection, self._io_loop)
            self._onNewIOStream(ios)

    @property
    def endpoints(self):
        return self._endpoints

    @property
    def ui_bootstraps(self):
        return self._bootstraps

    def _addBootstrap(self, bootstrap):
        bootstrap.start(self._bootstraps_nextId, self._io_loop, self._getBootstrapEntries, self._onBootstrapFoundEntry)
        self._bootstraps_nextId += 1
        self._bootstraps.append(bootstrap)

    ui_addBootstrap = _addBootstrap

    def _onBootstrapFoundEntry(self, bse):
        if bse.transportId != self.transport_id:
            return # We don't support that type of connections

        # We're just connecting to anything we can find
        self._connectTo(bse.addr, bse.port)

    def _connectTo(self, addr, port):
        family, socktype, proto, canonname, sockaddr = socket.getaddrinfo(addr, port, socket.AF_INET6, socket.SOCK_STREAM)[0]
        s = socket.socket(family, socktype, proto)
        s.setblocking(0)
        ios = tornado.iostream.IOStream(s, self._io_loop)

        ios.connect(sockaddr, functools.partial(self._onNewIOStream, ios))

    def _onNewIOStream(self, ios):
        ep = P2PEndpoint(ios, self._netCore, self._io_loop)
        self._endpoints.append(ep)
        self._netCore.transport_onNewEndpoint(self, ep)

    @property
    def _localPort(self):
        return self._servSock.getsockname()[1]

    def _getBootstrapEntries(self):
        return [bootstrap.BootstrapEntry(self.transport_id, None, self._localPort)]

    @property
    def ui_serverPort(self):
        return self._localPort

    def project_onLoad(self, project):
        for e in self.endpoints:
            project.handleEndpoint(e)

