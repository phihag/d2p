
import hashlib
import os.path
import subprocess

from . import project
from .projectmanager import ProjectManager
from .netcorebase import VirtualNetCore

import pyudev

_UDEV_SEARCHCRIT = dict(subsystem='block')
_UDEV_FILTER = lambda d: d.get('ID_BUS') == 'usb' and d.get('DEVTYPE') == 'partition'

def _mounted_devs():
    """ Returns a set of mounted devices """
    def parseMountOutput(output):
        for mountLine in output.split(b'\n'):
            mlItems = mountLine.split(b' ')
            if len(mlItems) < 3 or mlItems[1] != b'on':
                continue
            yield (mlItems[0].decode('ascii'), mlItems[2].decode('ascii'))

    mountOutput = subprocess.check_output('mount')
    return dict(parseMountOutput(mountOutput))

def _all_devs():
    context = pyudev.Context()
    uDevs = context.list_devices(**_UDEV_SEARCHCRIT)
    return filter(_UDEV_FILTER, uDevs)

def _get_endpointId(dev):
    return hashlib.sha256(dev['DEVNAME'].encode('UTF-8')).hexdigest()

def _dev_byEndpointId(endpointId):
    all_matching = list(filter(lambda d: _get_endpointId(d) == endpointId, _all_devs()))
    if not all_matching:
        raise KeyError('Endpoint not found')
    return all_matching[0]

def _mount(devName):
    subprocess.check_call(['pmount', devName])

def _umount(mountpoint):
    subprocess.check_call(['pumount', mountpoint])


class _VirtualEndpoint(object):
    """ The local system from the perspective of the DTN application """
    def __init__(self, realEndpoint):
        self._realEndpoint = realEndpoint

    def send(self, bs):
        self._realEndpoint.virtual_recv(bs)

class DTNEndpoint(object):
    """ Endpoint from the view of the local real application service """
    def __init__(self, epInfo, mountpoint, baseDir, netCore):
        self._mountpoint = mountpoint
        self._epInfo = epInfo
        self._baseDir = baseDir
        self._projects = {}
        self._netCore = netCore
        self._vEndpoint = _VirtualEndpoint(self)
        self._vNetCore = VirtualNetCore(self._vEndpoint, self._projects)

    def _load(self):
        if not os.path.exists(self._baseDir):
            os.mkdir(self._baseDir)
        projectsDir = os.path.join(self._baseDir, 'projects')
        if not os.path.exists(projectsDir):
            os.mkdir(projectsDir)
        for pid in os.listdir(projectsDir):
            pdir = os.path.join(projectsDir, pid)
            p = project.loadVirtualProject(pdir)
            assert p.idstr == pid
            self._projects[pid] = p
            p.netCore = self._vNetCore

    @staticmethod
    def createReal(epInfo, mountpoint, transport):
        baseDir = os.path.join(mountpoint, 'd2p_dtn')
        res = DTNEndpoint(epInfo, mountpoint, baseDir, transport._netCore)
        res._load()
        return res

    @property
    def ui_projects(self):
        return self._projects

    @property
    def ui_info(self):
        return self._epInfo

    def ui_addProject(self, localProject):
        projectsDir = os.path.join(self._baseDir, 'projects')
        p = localProject.makeVProject(projectsDir)
        assert p.idstr == localProject.idstr
        self._projects[p.idstr] = p
        p.netCore = self._vNetCore

    def send(self, bs):
        self._vNetCore.onRecv(self._vEndpoint, bs)

    def virtual_recv(self, bs):
        self._netCore.onRecv(self, bs)

    def umount(self):
        _umount(self._mountpoint)

class DTNTransport(object):
    transport_id = 'dtn'

    def __init__(self, io_loop, netCore, cfg):
        self._io_loop = io_loop
        self._netCore = netCore
        self._endpointDict = {}
        self._setupChangeMonitor()

        self._cfg = cfg.get('dtn', {
            'autoEnable': True
        })

    def ui_enable(self, endpointId):
        dev = _dev_byEndpointId(endpointId)
        eid = self._enable(dev)
        assert endpointId == eid

    def _enable(self, dev):
        mounted = _mounted_devs()
        if dev['DEVNAME'] not in mounted:
            _mount(dev['DEVNAME'])
            mounted = _mounted_devs()
        ei = self._getEndpointInfo(dev, mounted)
        endpointId = ei['id']
        ei['active'] = True
        ep = DTNEndpoint.createReal(ei, mounted[dev['DEVNAME']], self)
        self._endpointDict[endpointId] = ep
        self._netCore.transport_onNewEndpoint(self, ep)
        return endpointId

    def ui_disable(self, endpointId):
        ep = self._endpointDict[endpointId]
        del self._endpointDict[endpointId]
        ep.umount()

    def ui_listEndpointInfo(self):
        mounted = _mounted_devs()
        for dev in _all_devs():
            yield self._getEndpointInfo(dev, mounted)

    def _getEndpointInfo(self, dev, mounted):
        eid = _get_endpointId(dev)
        isMounted = dev['DEVNAME'] in mounted
        isActive = isMounted and eid in self._endpointDict
        return {
            'name': dev['ID_FS_LABEL'],
            'serial': dev['ID_SERIAL'],
            'os_id': dev['DEVNAME'],
            'id': eid,
            'active': isActive,
            'mounted': isMounted
        }

    def ui_getEndpoint(self, endpointId):
        return self._endpointDict[endpointId]

    @property
    def endpoints(self):
        return self._endpointDict.values()

    def project_onLoad(self, project):
        for e in self._endpointDict.values():
            project.handleEndpoint(e)

    def _setupChangeMonitor(self):
        context = pyudev.Context()
        monitor = pyudev.Monitor.from_netlink(context)
        monitor.filter_by(**_UDEV_SEARCHCRIT)
        def onDevEvent(fd, events):
            action,dev = monitor.receive_device()
            if not _UDEV_FILTER(dev):
                return # A device we don't care about (e.g. keyboard)
            if action == 'add':
                if self._cfg['autoEnable']:
                    self._enable(dev)
            # TODO handle removal as well
        self._io_loop.add_handler(monitor.fileno(), onDevEvent, self._io_loop.READ)
        monitor.enable_receiving()
